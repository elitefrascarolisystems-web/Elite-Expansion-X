import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import { ArmazemPostgres } from '../server/armazem-postgres.js';
import { decifrar, fazerBackup, obterChave } from '../server/backup.js';
import { RAIZ } from '../server/config.js';
import { migrar } from '../server/migracoes.js';
import { iniciarPostgres, postgresDisponivel } from './ajudantes/postgres.js';
import { cliente, criarConta, entrarComo, iniciarServidor } from './ajudantes/servidor.js';

const disponivel = postgresDisponivel();

describe('PostgreSQL', { skip: disponivel ? false : 'PostgreSQL não encontrado (initdb/pg_ctl); defina DATABASE_URL_TESTE para usar um banco externo.' }, () => {
  let banco;
  let armazem;
  before(async () => {
    banco = await iniciarPostgres();
    armazem = await new ArmazemPostgres(banco.url).iniciar();
  });
  after(async () => {
    await armazem?.fechar();
    await banco?.parar();
  });

  test('migrações aplicadas uma vez e conferidas a cada início', async () => {
    assert.equal(armazem.migracoes.novas.length, armazem.migracoes.total);
    const segundo = await new ArmazemPostgres(banco.url).iniciar();
    assert.equal(segundo.migracoes.novas.length, 0, 'nada é reaplicado');
    await segundo.fechar();
  });

  test('migração alterada depois de aplicada interrompe o início', async () => {
    const pasta = await mkdtemp(path.join(os.tmpdir(), 'animalx-mig-'));
    await cp(path.join(RAIZ, 'server/migrations'), pasta, { recursive: true });
    const arquivo = path.join(pasta, (await readdir(pasta))[0]);
    await writeFile(arquivo, `${await readFile(arquivo, 'utf8')}\n-- alterado`);
    const pool = new pg.Pool({ connectionString: banco.url });
    await assert.rejects(() => migrar(pool, { pasta }), /alterada depois de aplicada/);
    await pool.end();
    await rm(pasta, { recursive: true, force: true });
  });

  test('a API funciona igual com PostgreSQL, inclusive a separação de dados', async () => {
    const srv = await iniciarServidor({ armazem });
    await criarConta(armazem, { email: 'admin@pg.br', papel: 'admin' });
    await criarConta(armazem, { email: 'rev@pg.br', papel: 'revisor' });
    const cad = await cliente(srv.base).pedir('/api/cadastro', { metodo: 'POST', corpo: { nome: 'Est', email: 'est@pg.br', senha: 'senha-longa-ok' } });
    assert.equal(cad.status, 201);
    const est = await entrarComo(srv.base, 'est@pg.br', 'senha-longa-ok');
    const animal = (await est.pedir('/api/laboratorio/animais', { metodo: 'POST', corpo: { nome: 'Thor', especie: 'Cão', nascimento: '2020-01-31' } })).dados.animal;
    assert.equal(animal.nascimento, '2020-01-31');
    await est.pedir(`/api/laboratorio/animais/${animal.id}/registros`, { metodo: 'POST', corpo: { tipo: 'peso', valor: 27.5, data: '2026-10-01' } });
    const registros = (await est.pedir(`/api/laboratorio/animais/${animal.id}/registros`)).dados.registros;
    assert.equal(registros[0].valor, 27.5);
    assert.equal(registros[0].data, '2026-10-01');
    const adm = await entrarComo(srv.base, 'admin@pg.br');
    assert.deepEqual((await adm.pedir('/api/laboratorio/animais')).dados.animais, []);
    assert.equal((await adm.pedir(`/api/laboratorio/animais/${animal.id}/registros`)).status, 404);
    const rev = await entrarComo(srv.base, 'rev@pg.br');
    assert.equal((await rev.pedir('/api/revisoes', { metodo: 'POST', corpo: { estrutura: 'femur', status: 'em_revisao' } })).status, 200);
    assert.equal((await cliente(srv.base).pedir('/api/revisoes')).dados.revisoes.femur.status, 'em_revisao');
    const item = (await est.pedir('/api/biblioteca', { metodo: 'POST', corpo: { tipo: 'cena', titulo: 'Cena', dados: { ocultas: ['pele'], camera: { posicao: [1, 2, 3] } } } })).dados.item;
    assert.deepEqual(item.dados.ocultas, ['pele']);
    assert.equal((await rev.pedir(`/api/biblioteca/${item.id}`, { metodo: 'DELETE' })).status, 404);
    assert.equal((await est.pedir('/api/sair', { metodo: 'POST' })).status, 200);
    assert.equal((await est.pedir('/api/sessao')).dados.usuario, null);
    assert.ok((await armazem.listarAuditoria()).some((a) => a.acao === 'revisao' && a.alvo === 'femur'));
    await srv.fechar();
  });

  test('backup criptografado (AES-256-GCM) restaura o banco', async () => {
    const dados = await mkdtemp(path.join(os.tmpdir(), 'animalx-bkp-'));
    const config = { bancoUrl: banco.url, dadosDir: dados, backupDir: path.join(dados, 'backups') };
    await criarConta(armazem, { email: 'antes-do-backup@pg.br' });
    const r = await fazerBackup(config);
    const cifrado = await readFile(r.arquivo);
    assert.equal(cifrado.subarray(0, 4).toString(), 'AXB1');
    assert.equal(cifrado.includes(Buffer.from('antes-do-backup@pg.br')), false, 'conteúdo não aparece em claro');
    // Adulterar um byte quebra a autenticação.
    const adulterado = Buffer.from(cifrado);
    adulterado[adulterado.length - 1] ^= 0xff;
    const chave = await obterChave(config);
    assert.throws(() => decifrar(adulterado, chave));
    // Restaura num banco novo e confere a conta.
    banco.criarBanco?.('restaurado');
    if (banco.criarBanco) {
      const dump = path.join(dados, 'restore.dump');
      await writeFile(dump, decifrar(cifrado, chave));
      const destino = banco.url.replace(/\/animalx$/, '/restaurado');
      execFileSync('pg_restore', ['--no-owner', '--dbname', destino, dump]);
      const pool = new pg.Pool({ connectionString: destino });
      const { rows } = await pool.query('SELECT email FROM usuarios WHERE email = $1', ['antes-do-backup@pg.br']);
      await pool.end();
      assert.equal(rows.length, 1);
    }
    await rm(dados, { recursive: true, force: true });
  });
});

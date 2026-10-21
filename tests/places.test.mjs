import assert from 'node:assert/strict';
import test from 'node:test';
import {nameKey,personRoleFromText,placeLinkFromText,placeTypeFromText,sectorFromText} from '../lib/places.ts';

test('planilha: tipo, setor, vínculo e papel aceitam sem acento e formas curtas',()=>{
 assert.equal(nameKey('  Flávia   SILVA '),'flavia silva');
 assert.equal(placeTypeFromText('escritorio'),'Escritório Elite');assert.equal(placeTypeFromText('Network'),'Network / comunidade');assert.equal(placeTypeFromText('EMPRESA'),'Empresa');assert.equal(placeTypeFromText('Galpão'),null);assert.equal(placeTypeFromText(''),null);
 assert.equal(sectorFromText('saude'),'Saúde');assert.equal(sectorFromText('varejo'),'Comércio e varejo');assert.equal(sectorFromText('Tecnologia'),'Tecnologia');assert.equal(sectorFromText('xyz'),null);
 assert.equal(placeLinkFromText('sócio'),'Sócio / dono');assert.equal(placeLinkFromText('funcionario'),'Colaborador');assert.equal(placeLinkFromText('Membro do network'),'Membro do network');
 assert.equal(personRoleFromText('mentorada'),'Mentorado');assert.equal(personRoleFromText('Mentor'),'Mentor');assert.equal(personRoleFromText('Gerente'),null);
});

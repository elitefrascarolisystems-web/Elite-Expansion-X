-- Animal X — estrutura inicial.

CREATE TABLE usuarios (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  nome text NOT NULL,
  papel text NOT NULL CHECK (papel IN ('estudante', 'professor', 'especialista', 'revisor', 'instituicao', 'suporte', 'mentor', 'admin')),
  senha_hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessoes (
  token_hash text PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  csrf text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL
);
CREATE INDEX sessoes_usuario ON sessoes (usuario_id);

CREATE TABLE auditoria (
  id bigserial PRIMARY KEY,
  quando timestamptz NOT NULL DEFAULT now(),
  ator uuid,
  acao text NOT NULL,
  alvo text,
  resumo text
);

CREATE TABLE revisoes (
  estrutura text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('nao_revisado', 'em_revisao', 'revisado')),
  nota text,
  revisor_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  revisor_nome text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE biblioteca (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('cena', 'anotacao')),
  titulo text NOT NULL,
  dados jsonb NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX biblioteca_usuario ON biblioteca (usuario_id);

CREATE TABLE lab_animais (
  id uuid PRIMARY KEY,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nome text NOT NULL,
  especie text NOT NULL,
  nascimento date,
  sexo text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_animais_usuario ON lab_animais (usuario_id);

CREATE TABLE lab_registros (
  id uuid PRIMARY KEY,
  animal_id uuid NOT NULL REFERENCES lab_animais(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('peso', 'ecc', 'contexto')),
  valor numeric,
  texto text,
  data date NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_registros_animal ON lab_registros (animal_id);

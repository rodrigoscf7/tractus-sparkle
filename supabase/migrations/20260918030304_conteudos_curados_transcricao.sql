-- Transcript de reel no item curado (preenchido após salvar o top-1).
alter table public.conteudos_curados
  add column if not exists transcricao text;

comment on column public.conteudos_curados.transcricao is
  'Transcript do áudio do reel (captions nativas ou Whisper), preenchido após o insert do top-1.';

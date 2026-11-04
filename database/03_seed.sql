-- 03_seed.sql — Dados iniciais
-- Parte 1: categorias
insert into public.categorias (nome) values
  ('Blusas'), ('Camisetas'), ('Vestidos'), ('Calças'),
  ('Saias'), ('Shorts'), ('Jaquetas'), ('Acessórios')
on conflict (nome) do nothing;

-- Komponen rakit (switch, magnet, sekrup) sebagai material, terpisah dari packaging.
ALTER TYPE "public"."material_type" ADD VALUE IF NOT EXISTS 'part';

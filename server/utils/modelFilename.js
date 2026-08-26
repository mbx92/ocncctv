import { sanitizeText } from './sanitizeText.js'

const MODEL_EXT = new Set(['stl', 'obj', '3mf', 'glb', 'gltf'])
const MAX_STEM = 160

export function fileExt(name) {
  const parts = String(name || '').split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

export function fileStem(name) {
  const raw = String(name || '')
  const ext = fileExt(raw)
  if (!ext) return raw
  return raw.slice(0, -(ext.length + 1))
}

// Ganti nama tampilan; ekstensi asli dipertahankan agar preview/unduh tetap valid.
export function renameModelFilename(input, currentFilename) {
  const ext = fileExt(currentFilename)
  let name = sanitizeText(input)
  name = name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Nama file wajib diisi' })
  }
  const last = fileExt(name)
  if (last && MODEL_EXT.has(last)) name = fileStem(name).trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Nama file wajib diisi' })
  }
  if (name.length > MAX_STEM) name = name.slice(0, MAX_STEM).trim()
  return ext ? `${name}.${ext}` : name
}

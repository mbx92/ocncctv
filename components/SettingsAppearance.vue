<script setup>
import { CheckIcon, SwatchIcon } from '@heroicons/vue/24/outline'

const { theme, themes } = useTheme()
const activeName = computed(() => themes.find((item) => item.id === theme.value)?.name)
</script>

<template>
  <section class="panel p-4 sm:p-6 space-y-6" aria-labelledby="appearance-title">
    <div class="flex items-start gap-3">
      <div class="rounded-lg bg-accent-50 p-2.5 text-accent-700">
        <SwatchIcon class="h-5 w-5" />
      </div>
      <div>
        <h2 id="appearance-title" class="text-base font-semibold text-ink-900">Tampilan ruang kerja</h2>
        <p class="mt-1 text-sm leading-relaxed text-ink-500">Pilih suasana yang nyaman untuk pekerjaan sehari-hari.</p>
      </div>
    </div>

    <fieldset>
      <legend class="text-sm font-medium text-ink-700 mb-3">Tema aplikasi</legend>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label v-for="item in themes" :key="item.id" class="theme-option">
          <input v-model="theme" type="radio" name="app-theme" :value="item.id" class="peer sr-only" :aria-describedby="`theme-description-${item.id}`" />
          <span class="theme-option__card">
            <span v-if="item.id === 'default'" class="theme-preview" aria-hidden="true">
              <span class="theme-preview__sidebar">
                <span class="theme-preview__brand"><span class="theme-preview__mark"></span> OCN</span>
                <span class="theme-preview__nav theme-preview__nav--active"></span>
                <span v-for="n in 4" :key="n" class="theme-preview__nav"></span>
                <span class="theme-preview__profile"></span>
              </span>
              <span class="theme-preview__main">
                <span class="theme-preview__heading">Dashboard <span></span></span>
                <span class="theme-preview__stats">
                  <span v-for="n in 3" :key="n"><i></i><b></b></span>
                </span>
                <span class="theme-preview__table">
                  <span v-for="n in 4" :key="n"><i></i><i></i><i></i></span>
                </span>
              </span>
            </span>
            <span v-else class="network-theme-preview" aria-hidden="true">
              <span class="network-theme-preview__rail"><b><img src="/logo-mark.png" alt="" />OCN</b><i v-for="n in 6" :key="n"></i><em></em></span>
              <span class="network-theme-preview__body">
                <span class="network-theme-preview__topbar">Operasional <i></i></span>
                <span class="network-theme-preview__content">
                  <b>Dashboard</b>
                  <span class="network-theme-preview__hero"><span>Satu ruang untuk<br />seluruh pekerjaan.</span><i>08 <small>BERJALAN</small></i></span>
                  <span class="network-theme-preview__workflow"><i></i><i></i><i></i></span>
                  <span class="network-theme-preview__metrics"><i v-for="n in 4" :key="n"><b></b><em></em></i></span>
                </span>
              </span>
            </span>
            <span class="block p-4">
              <span class="flex items-center justify-between gap-2">
                <span class="font-semibold text-sm text-ink-900">{{ item.name }}</span>
                <span class="theme-option__check" aria-hidden="true"><CheckIcon v-if="theme === item.id" class="h-3.5 w-3.5" /></span>
              </span>
              <span :id="`theme-description-${item.id}`" class="block mt-2 text-sm leading-relaxed text-ink-500">{{ item.description }}</span>
              <span class="block mt-3 text-xs font-medium text-ink-500">{{ item.detail }}</span>
            </span>
          </span>
        </label>
      </div>
    </fieldset>

    <div class="border-t border-ink-100 pt-4 text-sm">
      <p class="flex items-center gap-2 font-medium text-ink-700" role="status" aria-live="polite">
        <CheckIcon class="h-4 w-4 text-teal-600 shrink-0" /> Tema {{ activeName }} aktif
      </p>
      <p class="mt-1 text-xs leading-relaxed text-ink-500">Perubahan langsung diterapkan dan disimpan otomatis di browser ini. Pilihan berlaku untuk semua akun yang memakai browser ini.</p>
    </div>
  </section>
</template>

<style scoped>
.theme-option { display: block; cursor: pointer; min-width: 0; }
.theme-option__card { display: block; height: 100%; overflow: hidden; border: 1px solid #d3d7dd; border-radius: 10px; background: #fff; transition: border-color 150ms, box-shadow 150ms; }
.theme-option:hover .theme-option__card { border-color: #7a8592; }
.peer:checked + .theme-option__card { border-color: #18628c; box-shadow: 0 0 0 1px #18628c; }
.peer:focus-visible + .theme-option__card { outline: 3px solid #5a9fc4; outline-offset: 4px; }
.theme-option__check { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1px solid #aab2bc; border-radius: 50%; }
.peer:checked + .theme-option__card .theme-option__check { background: #18628c; border-color: #18628c; color: white; }
.theme-preview { display: flex; height: 158px; border-bottom: 1px solid #e9ebee; background: #e9ebee; font-style: normal; }
.theme-preview__sidebar { display: flex; flex-direction: column; gap: 9px; width: 27%; padding: 13px 9px; background: #1f2429; }
.theme-preview__brand { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; color: #fff; font-size: 9px; font-weight: 700; }
.theme-preview__mark { width: 9px; height: 9px; border-radius: 2px; background: #5a9fc4; }
.theme-preview__nav { display: block; width: 80%; height: 5px; border-radius: 2px; background: #48515c; }
.theme-preview__nav--active { width: 100%; background: #5a9fc4; }
.theme-preview__profile { display: block; width: 12px; height: 12px; margin-top: auto; border-radius: 50%; background: #48515c; }
.theme-preview__main { flex: 1; min-width: 0; padding: 14px 10px; }
.theme-preview__heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 10px; font-weight: 600; color: #1f2429; }
.theme-preview__heading > span { width: 22px; height: 9px; background: #1f7aab; border-radius: 2px; }
.theme-preview__stats { display: flex; gap: 5px; margin-bottom: 10px; }
.theme-preview__stats > span { flex: 1; padding: 7px 5px; background: #fff; border: 1px solid #d3d7dd; border-radius: 3px; }
.theme-preview__stats i, .theme-preview__stats b { display: block; width: 70%; height: 3px; background: #d3d7dd; }
.theme-preview__stats b { width: 85%; height: 5px; background: #48515c; margin-top: 5px; }
.theme-preview__table { display: block; padding: 3px 7px; border: 1px solid #d3d7dd; border-radius: 3px; background: #fff; }
.theme-preview__table > span { display: flex; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid #e9ebee; }
.theme-preview__table > span:last-child { border: 0; }
.theme-preview__table i { width: 24%; height: 3px; background: #d3d7dd; }
.network-theme-preview { display: flex; height: 180px; background: #f3f5f7; border-bottom: 1px solid #e0e6eb; }
.network-theme-preview__rail { display: flex; flex-direction: column; gap: 10px; width: 24%; background: #102636; padding: 14px 10px; }
.network-theme-preview__rail > b { display: flex; align-items: center; gap: 4px; font-size: 12px; letter-spacing: 0; color: #eaf5f8; margin-bottom: 5px; }
.network-theme-preview__rail > b img { width: 12px; height: 12px; object-fit: contain; }
.network-theme-preview__rail > i { height: 4px; width: 85%; background: #466273; border-radius: 2px; }
.network-theme-preview__rail > i:nth-child(2) { background: #60c6c5; width: 100%; }
.network-theme-preview__rail > em { width: 13px; height: 13px; border-radius: 3px; background: #355668; margin-top: auto; }
.network-theme-preview__body { flex: 1; min-width: 0; }
.network-theme-preview__topbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 11px; background: white; border-bottom: 1px solid #e0e6eb; color: #607487; font-size: 6px; }
.network-theme-preview__topbar > i { height: 5px; width: 23px; background: #d6e7eb; }
.network-theme-preview__content { display: block; padding: 10px; }
.network-theme-preview__content > b { display: block; color: #192f42; font-size: 9px; margin-bottom: 8px; }
.network-theme-preview__hero { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 11px; background: #153344; color: white; border-radius: 5px; }
.network-theme-preview__hero > span { font-size: 8px; line-height: 1.6; }
.network-theme-preview__hero > i { font-size: 20px; color: #aed4de; font-style: normal; padding-left: 10px; border-left: 1px solid #3a5464; }
.network-theme-preview__hero small { display: block; font-size: 4px; letter-spacing: .1em; }
.network-theme-preview__workflow { display: flex; gap: 7px; margin-top: 7px; padding: 6px; background: white; border: 1px solid #e0e6eb; border-radius: 3px; }
.network-theme-preview__workflow > i { height: 3px; flex: 1; background: #b0c5cd; }
.network-theme-preview__metrics { display: flex; gap: 5px; margin-top: 7px; }
.network-theme-preview__metrics > i { display: block; padding: 6px 4px; flex: 1; background: white; border: 1px solid #e0e6eb; border-top: 2px solid #73aeb7; border-radius: 3px; }
.network-theme-preview__metrics b, .network-theme-preview__metrics em { display: block; height: 3px; width: 80%; background: #bacbd4; }
.network-theme-preview__metrics em { margin-top: 4px; height: 4px; width: 65%; background: #426074; }
.theme-preview { height: 180px; }
@media (prefers-reduced-motion: reduce) { .theme-option__card { transition: none; } }
</style>

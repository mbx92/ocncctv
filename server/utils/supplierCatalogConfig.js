export const SUPPLIER_CATALOG_DEFAULT_SPREADSHEET_ID = '1aaKkgM9NVRsdKTFhqE46lvyLZ4rsLtxcq3_ninX6ncg'
export const SUPPLIER_CATALOG_DEFAULT_NAME = 'PL TUNAS JAYA ELEKTRONIK'

export const SUPPLIER_CATALOG_SHEETS = [
  { key: 'hikvision-analog-dvr', label: 'HIKVISION ANALOG & DVR', sheetName: 'HIKVISION ANALOG DAN DVR', gid: '1662963114' },
  { key: 'hikvision-ip-part-1', label: 'HIKVISION IP CAMERA PART 1', sheetName: 'HIKVISION IP CAMERA PART 1', gid: '743532671' },
  { key: 'hikvision-ip-ptz', label: 'HIKVISION IP CAMERA & PTZ', sheetName: 'HIKVISION IP CAMERA DAN IP CAMERA PTZ', gid: '2009540950' },
  { key: 'hikvision-nvr', label: 'HIKVISION NVR', sheetName: 'HIKVISION NVR', gid: '612304622' },
  { key: 'hikvision-access-poe', label: 'HIKVISION ACCESS / POE / PSU', sheetName: 'HIKVISION ACCES CONTROL, POE SWITCH, PSU', gid: '20866649' },
  { key: 'hilook', label: 'HILOOK', sheetName: 'HILOOK', gid: '1048074398' },
  { key: 'ezviz', label: 'EZVIZ', sheetName: 'EZVIZ', gid: '80707125' },
  { key: 'dahua-analog-dvr', label: 'DAHUA ANALOG & DVR', sheetName: 'DAHUA ANALOG CAMERA DAN DVR', gid: '2140306103' },
  { key: 'dahua-ip-nvr', label: 'DAHUA IP CAMERA & NVR', sheetName: 'DAHUA IP CAMERA DAN NVR', gid: '532806829' },
  { key: 'dahua-poe-psu', label: 'DAHUA POE / PSU', sheetName: 'DAHUA POE SWITCH, PSU, DLL', gid: '1919306222' },
  { key: 'tiandy', label: 'TIANDY', sheetName: 'TIANDY', gid: '2124632806' },
  { key: 'ruijie', label: 'RUIJIE', sheetName: 'RUIJIE', gid: '489488932' },
  { key: 'imou', label: 'IMOU', sheetName: 'IMOU', gid: '697625412' },
  { key: 'microsd', label: 'MICROSD', sheetName: 'MICROSD', gid: '974456429' },
  { key: 'hdd', label: 'HDD', sheetName: 'HDD', gid: '34342766' },
  { key: 'ups', label: 'UPS', sheetName: 'UPS', gid: '1499124706' },
  { key: 'mikrotik', label: 'MIKROTIK', sheetName: 'MIKROTIK', gid: '2072391326' },
  { key: 'vention', label: 'VENTION', sheetName: 'VENTION', gid: '1729234644' },
  { key: 'tplink', label: 'TPLINK', sheetName: 'TPLINK', gid: '1663184314' },
  { key: 'foredge', label: 'FOREDGE', sheetName: 'FOREDGE', gid: '1060392296' },
  { key: 'mercusys-huawei', label: 'MERCUSYS & HUAWEI', sheetName: 'MERCUSYS&HUAWEI', gid: '1157509812' },
  { key: 'robot', label: 'ROBOT', sheetName: 'ROBOT', gid: '1662273075' },
  { key: 'takasi', label: 'TAKASI', sheetName: 'TAKASI', gid: '935348596' },
  { key: 'konektor', label: 'KONEKTOR', sheetName: 'KONEKTOR', gid: '1240664764' },
  { key: 'toa', label: 'TOA', sheetName: 'TOA', gid: '270211487' },
  { key: 'ht', label: 'HT', sheetName: 'HT', gid: '2124552687' },
  { key: 'adaptor', label: 'ADAPTOR', sheetName: 'ADAPTOR', gid: '1444735387' },
  { key: 'hdmi-connlex-websong', label: 'HDMI CONNLEX / WEBSONG', sheetName: 'HDMI CONNLEX/WEBSONG', gid: '734294976' },
  { key: 'rak-server', label: 'RAK SERVER', sheetName: 'RAK SERVER', gid: '1035273974' },
  { key: 'kabel-lan-rg', label: 'KABEL LAN / RG', sheetName: 'KABEL LAN/RG', gid: '1700583241' },
  { key: 'patchcord', label: 'PATCHCORD', sheetName: 'PATCHCORD', gid: '1933301537' },
  { key: 'precon-fiber', label: 'PRECON FIBER', sheetName: 'PRECON FIBER', gid: '235156957' }
]

export function findCatalogSheet(sheetKey) {
  return SUPPLIER_CATALOG_SHEETS.find((s) => s.key === sheetKey) || null
}

export function getSupplierCatalogSettings(config = {}) {
  return {
    spreadsheetId: config.spreadsheetId || SUPPLIER_CATALOG_DEFAULT_SPREADSHEET_ID,
    supplierName: config.supplierName || SUPPLIER_CATALOG_DEFAULT_NAME
  }
}

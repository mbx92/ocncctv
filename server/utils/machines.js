export function parseMachineQuantity(value) {
  const n = Math.round(Number(value) || 0)
  return n > 0 ? n : 1
}

export function machineUnitPrice(value) {
  return Math.max(Math.round(Number(value) || 0), 0)
}

export function machineTotalValue(machine) {
  if (!machine) return 0
  return machineUnitPrice(machine.purchasePrice) * parseMachineQuantity(machine.quantity)
}

import { supabase } from './supabase'

// 与 kid-tasks 共用同一家庭码，实现两个应用同一套用户/积分跨设备共享
const FAMILY_KEY = 'kid-tasks.familyId'

// 生成高熵随机家庭码：字母数字，无易混淆字符
function randomFamilyCode(length = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  for (let i = 0; i < length; i++) {
    out += chars[arr[i] % chars.length]
  }
  return out
}

export function getFamilyId(): string {
  let id = localStorage.getItem(FAMILY_KEY)
  if (!id) {
    id = randomFamilyCode()
    localStorage.setItem(FAMILY_KEY, id)
    void registerFamily(id)
  }
  return id
}

export function setFamilyId(id: string): void {
  localStorage.setItem(FAMILY_KEY, id.trim())
  void registerFamily(id.trim())
}

async function registerFamily(id: string): Promise<void> {
  try {
    await supabase.from('families').upsert({ id }, { onConflict: 'id' })
  } catch {
    // 忽略注册失败（RLS 未开或断网）
  }
}

// 与 kid-tasks 共享同一套 families/kid_data 表，用独立 key 前缀区分
export async function loadRemote(familyId: string, key: string) {
  const { data, error } = await supabase
    .from('kid_data')
    .select('value')
    .eq('family_id', familyId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw error
  return data?.value ?? null
}

export async function saveRemote(familyId: string, key: string, value: unknown) {
  const { error } = await supabase
    .from('kid_data')
    .upsert({ family_id: familyId, key, value }, { onConflict: 'family_id,key' })
  if (error) throw error
}

export function resetFamilyId(): void {
  localStorage.removeItem(FAMILY_KEY)
  window.location.reload()
}

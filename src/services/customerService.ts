import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface CustomerRecord {
  id?: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  contracts_count?: number;
  total_rent?: number;
  first_contract_date?: string | null;
  last_contract_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function getCustomers(): Promise<CustomerRecord[]> {
  const { data, error } = await supabase
    .from('customers' as any)
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as any;
}

export async function syncCustomersFromContracts(): Promise<{ inserted: number; updated: number; total: number }>{
  // اجلب العقود لتجميع العملاء
  const { data: contracts, error } = await supabase
    .from('Contract' as any)
    .select('"Customer Name", Company, Phone, "Total Rent", "Contract Date", "End Date"');

  if (error) throw error;
  const map = new Map<string, CustomerRecord & { _count: number; _sum: number; _first?: string; _last?: string }>();

  for (const c of (contracts as any[]) || []) {
    const name: string = c['Customer Name'] || '';
    if (!name) continue;
    const phone: string | null = c['Phone'] ?? null;
    const company: string | null = c['Company'] ?? null;
    const totalRentNum = Number(c['Total Rent'] ?? 0) || 0;
    const startDate = c['Contract Date'] || null;
    const endDate = c['End Date'] || null;

    const key = `${name.toLowerCase()}|${(phone || '').toLowerCase()}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, {
        name,
        phone,
        company,
        contracts_count: 1,
        total_rent: totalRentNum,
        _count: 1,
        _sum: totalRentNum,
        _first: startDate,
        _last: endDate,
      });
    } else {
      prev._count += 1;
      prev._sum += totalRentNum;
      prev.contracts_count = prev._count;
      prev.total_rent = prev._sum;
      // first/last تواريخ
      const first = prev._first ? new Date(prev._first) : null;
      const last = prev._last ? new Date(prev._last) : null;
      const s = startDate ? new Date(startDate) : null;
      const e = endDate ? new Date(endDate) : null;
      if (s && (!first || s < first)) prev._first = startDate;
      if (e && (!last || e > last)) prev._last = endDate;
    }
  }

  const payload: CustomerRecord[] = Array.from(map.values()).map((r) => ({
    name: r.name,
    phone: r.phone ?? null,
    company: r.company ?? null,
    contracts_count: r.contracts_count || 0,
    total_rent: r.total_rent || 0,
    first_contract_date: r._first ?? null,
    last_contract_date: r._last ?? null,
  }));

  // حاول القراءة الحالية لتحديث/إضافة بدون onConflict
  const { data: existing, error: existingErr } = await supabase
    .from('customers' as any)
    .select('id, name, phone');

  if (existingErr && String(existingErr.message || '').toLowerCase().includes('does not exist')) {
    // جدول العملاء غير موجود
    throw new Error('جدول العملاء غير موجود في قاعدة البيانات. الرجاء إنشاؤه أولاً.');
  }
  if (existingErr) throw existingErr;

  const existingMap = new Map<string, any>();
  for (const row of (existing as any[]) || []) {
    const key = `${String(row.name || '').toLowerCase()}|${String(row.phone || '').toLowerCase()}`;
    existingMap.set(key, row);
  }

  const toInsert: CustomerRecord[] = [];
  const toUpdate: (CustomerRecord & { id: string })[] = [];

  for (const rec of payload) {
    const key = `${rec.name.toLowerCase()}|${String(rec.phone || '').toLowerCase()}`;
    const found = existingMap.get(key);
    if (found && found.id) {
      toUpdate.push({ ...rec, id: found.id });
    } else {
      toInsert.push(rec);
    }
  }

  let inserted = 0, updated = 0;

  if (toInsert.length > 0) {
    const { error: insertErr, data: ins } = await supabase
      .from('customers' as any)
      .insert(toInsert as any)
      .select('id');
    if (insertErr) throw insertErr;
    inserted = (ins || []).length;
  }

  if (toUpdate.length > 0) {
    for (const rec of toUpdate) {
      const { error: upErr } = await supabase
        .from('customers' as any)
        .update({
          name: rec.name,
          phone: rec.phone ?? null,
          company: rec.company ?? null,
          contracts_count: rec.contracts_count || 0,
          total_rent: rec.total_rent || 0,
          first_contract_date: rec.first_contract_date ?? null,
          last_contract_date: rec.last_contract_date ?? null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', rec.id);
      if (upErr) throw upErr;
      updated += 1;
    }
  }

  return { inserted, updated, total: payload.length };
}

export async function updateCustomerPayment(id: string, patch: Partial<CustomerPayment>) {
  const payload: any = { ...patch };
  if (payload.paid_at && payload.paid_at.length <= 10) {
    payload.paid_at = new Date(payload.paid_at).toISOString();
  }
  const { data, error } = await (supabase as any)
    .from('customer_payments')
    .update({
      amount: patch.amount as any,
      entry_type: (patch.entry_type as any),
      method: patch.method as any,
      reference: patch.reference as any,
      notes: patch.notes as any,
      contract_number: patch.contract_number as any,
      paid_at: (patch.paid_at as any) || undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CustomerPayment;
}

export async function deleteCustomerPayment(id: string) {
  const { error } = await (supabase as any)
    .from('customer_payments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

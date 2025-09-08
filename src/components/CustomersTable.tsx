import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { getCustomers, syncCustomersFromContracts, type CustomerRecord } from '@/services/customerService';
import { Users, RefreshCw, Search, Building2, Phone, CalendarRange, DollarSign } from 'lucide-react';

export default function CustomersTable() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (e: any) {
      const msg = e?.message || 'تعذر تحميل العملاء';
      toast({ title: 'خطأ', description: msg as any, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await syncCustomersFromContracts();
      toast({ title: 'تم التحديث', description: `تمت مزامنة ${res.total} عميل (مضاف: ${res.inserted}، محدّث: ${res.updated})` as any });
      await load();
    } catch (e: any) {
      let msg = e?.message || '';
      if (msg.includes('جدول العملاء غير موجود')) {
        msg += '\nيرجى إنشاء جدول customers في Supabase ثم إعادة المحاولة.';
      }
      toast({ title: 'خطأ في المزامنة', description: msg as any, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.company || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  }, [customers, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Users className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">العملاء</h2>
            <p className="text-muted-foreground">عرض وإدارة قائمة العملاء المستخرجة من العقود</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSync} disabled={syncing} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            مزامنة من العقود
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>جدول العملاء</CardTitle>
              <CardDescription>يتم التحديث من العقود تلقائياً عب�� زر المزامنة</CardDescription>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="ابحث بالاسم أو الشركة أو الهاتف" value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="mr-2">جاري تحميل العملاء...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الشركة</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">عدد العقود</TableHead>
                  <TableHead className="text-right">إجمالي الإيجار</TableHead>
                  <TableHead className="text-right">أول عقد</TableHead>
                  <TableHead className="text-right">آخر عقد</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={`${c.id || c.name}-${c.phone || ''}`}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {c.company || 'غير محدد'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {c.phone || 'غير محدد'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.contracts_count ?? 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {(c.total_rent ?? 0).toLocaleString('ar-LY')} د.ل
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarRange className="h-4 w-4 text-muted-foreground" />
                        {c.first_contract_date ? new Date(c.first_contract_date).toLocaleDateString('ar-LY') : '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.last_contract_date ? new Date(c.last_contract_date).toLocaleDateString('ar-LY') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      لا توجد بيانات مطابقة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

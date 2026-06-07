import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search, X, Keyboard, Users, ExternalLink } from 'lucide-react';

import { useKeycap, useSaveKeycap } from '@/api/keycap';
import { calculateStats } from '@/lib/keycap/calc';
import { parseMoney, formatMoneyInput } from '@/lib/moneyParse';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import ItemCard from '@/components/keycap/ItemCard';
import SummaryBar from '@/components/keycap/SummaryBar';
import StatsView from '@/components/keycap/StatsView';

import {
  type KeycapItem,
  type KeycapGroup,
  type ItemCategory,
  type ItemStatus,
  ITEM_CATS,
} from '@/lib/keycap/types';

// ============================================================
// Keycap Page
// ============================================================
//
// 4 tabs: Kho / Đã bán / Thống kê / Groups
// Summary bar sticky ở trên
// Filter: search + category + sort
//
// Note: Dialogs phức tạp (ItemDialog, LotDialog) sẽ dùng prompt tạm.
// Bạn có thể bảo tôi build dialog đẹp sau.
// ============================================================

type SortMode = 'newest' | 'profit' | 'price' | 'name';

export default function Keycap() {
  const keycapQuery = useKeycap();
  const save = useSaveKeycap();

  const [activeTab, setActiveTab] = useState('inventory');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<ItemCategory | ''>('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  const data = keycapQuery.data;
  const inventory = data?.inventory ?? { items: [], lots: [], groups: [] };
  const { items, lots, groups } = inventory;
  const stats = useMemo(() => calculateStats(items, lots), [items, lots]);

  // Filter + sort
  const getFiltered = (status: ItemStatus | 'available+incoming') => {
    let list = items.filter((i) =>
      status === 'available+incoming'
        ? i.status === 'available' || i.status === 'incoming'
        : i.status === status,
    );
    if (catFilter) list = list.filter((i) => i.cat === catFilter);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => i.name.toLowerCase().includes(q) || i.tags.toLowerCase().includes(q));

    const sorted = [...list];
    switch (sortMode) {
      case 'newest':
        sorted.sort((a, b) => b.buyDate.localeCompare(a.buyDate));
        break;
      case 'profit':
        sorted.sort((a, b) => {
          const ap = (a.status === 'sold' ? a.actualPrice : a.sellPrice) - a.buyPrice;
          const bp = (b.status === 'sold' ? b.actualPrice : b.sellPrice) - b.buyPrice;
          return bp - ap;
        });
        break;
      case 'price':
        sorted.sort((a, b) => b.buyPrice - a.buyPrice);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  };

  // ============================================================
  // Quick actions (prompt-based for now)
  // ============================================================

  function quickAddItem() {
    const name = window.prompt('Tên item:');
    if (!name) return;
    const buyPriceStr = window.prompt('Giá mua (vd: 150k):') ?? '0';
    const sellPriceStr = window.prompt('Giá bán dự kiến (vd: 200k, hoặc ?):') ?? '0';
    const catStr = window.prompt('Loại (keycap/keyboard/switch/other):', 'keycap') ?? 'keycap';

    const newItem: KeycapItem = {
      id: 'kc_' + Date.now(),
      name,
      cat: (['keycap', 'keyboard', 'switch', 'other'].includes(catStr) ? catStr : 'keycap') as ItemCategory,
      status: 'available',
      buyPrice: parseMoney(buyPriceStr),
      sellPrice: parseMoney(sellPriceStr),
      actualPrice: 0,
      shippingCost: 0,
      buyDate: new Date().toISOString().split('T')[0],
      soldDate: null,
      lotId: null,
      groupId: null,
      buyer: '',
      soldVia: null,
      imageUrl: '',
      tags: '',
      note: '',
    };

    saveAll({ ...inventory, items: [newItem, ...items] });
  }

  function quickMarkSold(item: KeycapItem) {
    const priceStr = window.prompt(`Giá bán thực tế cho "${item.name}":`, formatMoneyInput(item.sellPrice));
    if (priceStr === null) return;
    const actualPrice = parseMoney(priceStr);
    const buyer = window.prompt('Tên người mua (optional):') ?? '';

    const updated: KeycapItem = {
      ...item,
      status: 'sold',
      actualPrice,
      buyer,
      soldDate: new Date().toISOString().split('T')[0],
    };

    const newItems = items.map((i) => (i.id === item.id ? updated : i));
    saveAll({ ...inventory, items: newItems });
  }

  function deleteItem(item: KeycapItem) {
    if (!window.confirm(`Xoá "${item.name}"?`)) return;
    // Snapshot buyPrice nếu thuộc lot (standalone)
    const newItems = items.filter((i) => i.id !== item.id);
    saveAll({ ...inventory, items: newItems });
  }

  function editItem(item: KeycapItem) {
    const name = window.prompt('Tên:', item.name);
    if (name === null) return;
    const sellStr = window.prompt('Giá bán:', formatMoneyInput(item.sellPrice));
    if (sellStr === null) return;
    const note = window.prompt('Ghi chú:', item.note) ?? '';

    const updated: KeycapItem = {
      ...item,
      name,
      sellPrice: parseMoney(sellStr),
      note,
    };
    const newItems = items.map((i) => (i.id === item.id ? updated : i));
    saveAll({ ...inventory, items: newItems });
  }

  function addGroup() {
    const name = window.prompt('Tên group:');
    if (!name) return;
    const url = window.prompt('URL (optional):') ?? '';
    const newGroup: KeycapGroup = {
      id: 'grp_' + Date.now(),
      name,
      url,
      members: '',
      note: '',
    };
    saveAll({ ...inventory, groups: [...groups, newGroup] });
  }

  function deleteGroup(id: string) {
    if (!window.confirm('Xoá group này?')) return;
    saveAll({ ...inventory, groups: groups.filter((g) => g.id !== id) });
  }

  function saveAll(newInventory: typeof inventory) {
    save.mutate(
      { recordId: data?.recordId ?? null, inventory: newInventory },
      {
        onSuccess: () => toast.success('Đã lưu'),
        onError: () => toast.error('Lỗi lưu'),
      },
    );
  }

  if (keycapQuery.isLoading) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border p-4">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground">
            <Keyboard className="h-4 w-4" />
            Keycap Inventory
          </h1>
        </div>
        <Button onClick={quickAddItem} size="sm" className="gap-1.5" disabled={save.isPending}>
          <Plus className="h-4 w-4" />
          Thêm
        </Button>
      </header>

      <SummaryBar stats={stats} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-3 pt-2">
          <TabsList>
            <TabsTrigger value="inventory">Kho</TabsTrigger>
            <TabsTrigger value="sold">Đã bán</TabsTrigger>
            <TabsTrigger value="stats">Thống kê</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>
        </div>

        {/* Filter bar (only for inventory/sold) */}
        {(activeTab === 'inventory' || activeTab === 'sold') && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm..."
                className="h-7 pl-7 pr-7 text-xs"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as ItemCategory | '')}
              className="h-7 border border-border bg-background px-2 text-xs"
            >
              <option value="">Tất cả</option>
              {(Object.entries(ITEM_CATS) as [ItemCategory, { label: string }][]).map(
                ([key, val]) => (
                  <option key={key} value={key}>
                    {val.label}
                  </option>
                ),
              )}
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="h-7 border border-border bg-background px-2 text-xs"
            >
              <option value="newest">Mới nhất</option>
              <option value="profit">Lời nhất</option>
              <option value="price">Giá cao nhất</option>
              <option value="name">Tên A-Z</option>
            </select>
          </div>
        )}

        <TabsContent value="inventory" className="m-0 flex-1 overflow-y-auto p-3">
          <ItemGrid
            items={getFiltered('available+incoming')}
            lots={lots}
            groups={groups}
            onEdit={editItem}
            onMarkSold={quickMarkSold}
            onDelete={deleteItem}
          />
        </TabsContent>

        <TabsContent value="sold" className="m-0 flex-1 overflow-y-auto p-3">
          <ItemGrid
            items={getFiltered('sold')}
            lots={lots}
            groups={groups}
            onEdit={editItem}
            onMarkSold={() => {}}
            onDelete={deleteItem}
          />
        </TabsContent>

        <TabsContent value="stats" className="m-0 flex-1 overflow-y-auto">
          <StatsView items={items} lots={lots} groups={groups} />
        </TabsContent>

        <TabsContent value="groups" className="m-0 flex-1 overflow-y-auto p-4">
          <GroupsList groups={groups} onAdd={addGroup} onDelete={deleteGroup} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
function ItemGrid({
  items,
  lots,
  groups,
  onEdit,
  onMarkSold,
  onDelete,
}: {
  items: KeycapItem[];
  lots: Array<{ id: string; name: string }>;
  groups: KeycapGroup[];
  onEdit: (item: KeycapItem) => void;
  onMarkSold: (item: KeycapItem) => void;
  onDelete: (item: KeycapItem) => void;
}) {
  if (items.length === 0) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Không có item nào</div>;
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => {
        const lot = item.lotId ? lots.find((l: { id: string }) => l.id === item.lotId) : undefined;
        const group = item.groupId ? groups.find((g) => g.id === item.groupId) : undefined;
        return (
          <ItemCard
            key={item.id}
            item={item}
            lotName={lot?.name}
            groupName={group?.name}
            onEdit={() => onEdit(item)}
            onMarkSold={() => onMarkSold(item)}
            onDelete={() => onDelete(item)}
          />
        );
      })}
    </div>
  );
}

function GroupsList({
  groups,
  onAdd,
  onDelete,
}: {
  groups: KeycapGroup[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Users className="h-4 w-4" />
          Groups ({groups.length})
        </h3>
        <Button size="sm" onClick={onAdd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Thêm group
        </Button>
      </div>
      {groups.length === 0 ? (
        <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Chưa có group nào
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between border border-border bg-card p-3">
              <div>
                <div className="text-sm font-medium text-foreground">{g.name}</div>
                <div className="text-xs text-muted-foreground">
                  {g.url && (
                    <span className="mr-2 inline-flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {g.url}
                    </span>
                  )}
                  {g.members && <span>{g.members} thành viên</span>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onDelete(g.id)} className="text-destructive">
                Xoá
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

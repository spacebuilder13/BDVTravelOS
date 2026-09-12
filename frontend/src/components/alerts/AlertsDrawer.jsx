import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ScrollArea } from '../ui/scroll-area';
import { alertsAPI } from '../../services/api';
import { toast } from 'sonner';
import { Bell, Plus, X, RefreshCw, Calendar, Clock } from 'lucide-react';

const fmtDate = (iso) => {
  if (!iso) return 'No due date';
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const alertDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((alertDay - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const isOverdue = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date(); today.setHours(0,0,0,0);
  return d < today;
};

const isDueToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

// ── Add Alert Modal ────────────────────────────────────────────────────────
function AddAlertModal({ open, onClose, onCreated }) {
  const [msg, setMsg] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [repeat, setRepeat] = useState('none');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!msg.trim()) { toast.error('Message is required'); return; }
    setSaving(true);
    try {
      const res = await alertsAPI.create({
        message: msg,
        due_at: dueDate ? `${dueDate}T09:00:00Z` : new Date().toISOString(),
        repeat,
      });
      toast.success('Alert created');
      onCreated(res.data);
      onClose();
      setMsg(''); setDueDate(''); setRepeat('none');
    } catch {
      toast.error('Failed to create alert');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#c9a84c]" /> Add Alert
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs mb-1.5 block">Message *</Label>
            <textarea
              className="w-full h-20 text-sm px-2.5 py-2 border border-[#e6e9f0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#c9a84c] resize-none"
              value={msg} onChange={e => setMsg(e.target.value)}
              placeholder="e.g. Call client for Dubai quote confirmation"
              data-testid="alert-message-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs mb-1.5 block">Due Date</Label>
              <input type="date" className="h-8 w-full text-xs px-2 border border-[#e6e9f0] rounded-md focus:outline-none focus:ring-1 focus:ring-[#c9a84c]"
                value={dueDate} onChange={e => setDueDate(e.target.value)}
                data-testid="alert-due-date" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Repeat</Label>
              <Select value={repeat} onValueChange={setRepeat}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={saving || !msg.trim()}
            data-testid="alert-save-btn"
            style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}>
            {saving ? 'Saving...' : 'Create Alert'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Alert Card ─────────────────────────────────────────────────────────────
function AlertCard({ a, onDismiss, onSnooze }) {
  const overdue = isOverdue(a.due_at);
  const today = isDueToday(a.due_at);
  const bg = overdue ? 'border-red-200 bg-red-50/60' : today ? 'border-amber-200 bg-amber-50/60' : 'border-[#e6e9f0] bg-white';

  return (
    <div className={`rounded-lg border p-3 space-y-2 ${bg}`} data-testid={`alert-card-${a.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-[#0b1220] leading-snug">{a.message}</p>
        <button type="button" onClick={() => onDismiss(a, false)}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475] flex-shrink-0">
          <X className="w-3 h-3" />
        </button>
      </div>
      {a.due_at && (
        <p className={`text-[10px] flex items-center gap-1 ${overdue ? 'text-red-600 font-semibold' : today ? 'text-amber-600 font-semibold' : 'text-[#5b6475]'}`}>
          <Calendar className="w-3 h-3" />{fmtDate(a.due_at)}
        </p>
      )}
      {a.linked_entity_name && (
        <p className="text-[10px] text-[#5b6475]">
          <span className="capitalize">{a.linked_entity_type}</span>: {a.linked_entity_name}
        </p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <button type="button" onClick={() => onDismiss(a, false)}
          className="h-6 px-2.5 rounded text-[10px] font-semibold text-white transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#0a1628' }}>
          Mark Done
        </button>
        <button type="button" onClick={() => onDismiss(a, true)}
          className="h-6 px-2 rounded text-[10px] border border-[#e6e9f0] text-[#5b6475] hover:bg-[#f2f4f8] transition-colors">
          Re-alert in 1d
        </button>
        <button type="button" onClick={() => onSnooze(a, 1)}
          className="h-6 px-2 rounded text-[10px] border border-[#e6e9f0] text-[#5b6475] hover:bg-[#f2f4f8] transition-colors flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />Snooze 1h
        </button>
        <button type="button" onClick={() => onSnooze(a, 24)}
          className="h-6 px-2 rounded text-[10px] border border-[#e6e9f0] text-[#5b6475] hover:bg-[#f2f4f8] transition-colors">
          Tomorrow
        </button>
      </div>
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────
export function AlertsDrawer({ open, onClose, onCountChange }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertsAPI.list();
      const data = res.data || [];
      setAlerts(data);
      onCountChange?.(data.length);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [onCountChange]);

  useEffect(() => { if (open) loadAlerts(); }, [open, loadAlerts]);

  const handleDismiss = async (a, reAlert) => {
    try {
      await alertsAPI.dismiss(a.id, reAlert);
      const msg = reAlert ? 'Dismissed — will re-alert tomorrow' : 'Alert marked as done';
      toast.success(msg);
      setAlerts(prev => prev.filter(x => x.id !== a.id));
      onCountChange?.(alerts.length - 1);
    } catch { toast.error('Failed to dismiss alert'); }
  };

  const handleSnooze = async (a, hours) => {
    const snoozed_until = new Date(Date.now() + hours * 3600000).toISOString();
    try {
      await alertsAPI.snooze(a.id, snoozed_until);
      toast.success(`Snoozed for ${hours}h`);
      setAlerts(prev => prev.filter(x => x.id !== a.id));
      onCountChange?.(alerts.length - 1);
    } catch { toast.error('Failed to snooze'); }
  };

  const overdue = alerts.filter(a => isOverdue(a.due_at));
  const today = alerts.filter(a => isDueToday(a.due_at));
  const upcoming = alerts.filter(a => !isOverdue(a.due_at) && !isDueToday(a.due_at));

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-[380px] p-0 flex flex-col" data-testid="alerts-drawer">
          <SheetHeader className="px-4 py-3 border-b border-[#e6e9f0] flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#c9a84c]" />
                Alerts & Reminders
                {alerts.length > 0 && (
                  <Badge className="text-[9px] px-1.5 h-4 font-bold"
                    style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}>
                    {alerts.length}
                  </Badge>
                )}
              </SheetTitle>
              <div className="flex items-center gap-1">
                <button onClick={loadAlerts}
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f2f4f8] text-[#5b6475]">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <Button size="sm" className="h-7 text-xs gap-1" data-testid="add-alert-btn"
                  style={{ backgroundColor: '#0a1628', color: '#c9a84c' }}
                  onClick={() => setShowAdd(true)}>
                  <Plus className="w-3 h-3" /> Add Alert
                </Button>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#c9a84c', borderTopColor: 'transparent' }} />
                </div>
              ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-10 h-10 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center mb-3">
                    <Bell className="w-5 h-5 text-[#c9a84c]" />
                  </div>
                  <p className="text-sm font-medium text-[#0b1220]">No pending alerts</p>
                  <p className="text-xs text-[#5b6475] mt-1">All caught up! Alerts from new enquiries will appear here.</p>
                </div>
              ) : (
                <>
                  {overdue.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-red-500 mb-2">Overdue</p>
                      <div className="space-y-2">{overdue.map(a => <AlertCard key={a.id} a={a} onDismiss={handleDismiss} onSnooze={handleSnooze} />)}</div>
                    </div>
                  )}
                  {today.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-amber-600 mb-2">Due Today</p>
                      <div className="space-y-2">{today.map(a => <AlertCard key={a.id} a={a} onDismiss={handleDismiss} onSnooze={handleSnooze} />)}</div>
                    </div>
                  )}
                  {upcoming.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-[#5b6475] mb-2">Upcoming</p>
                      <div className="space-y-2">{upcoming.map(a => <AlertCard key={a.id} a={a} onDismiss={handleDismiss} onSnooze={handleSnooze} />)}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <AddAlertModal open={showAdd} onClose={() => setShowAdd(false)}
        onCreated={(a) => { setAlerts(prev => [a, ...prev]); onCountChange?.(alerts.length + 1); }} />
    </>
  );
}

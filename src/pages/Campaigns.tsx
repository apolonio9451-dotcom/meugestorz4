import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar as CalendarIcon,
  Heart,
  Gift,
  Sparkles,
  PartyPopper,
  Flower2,
  Cake,
  CheckCircle2,
  Circle,
  Settings2,
  Upload,
  Play,
  Pause,
  Square,
  Users,
  Image as ImageIcon,
  Loader2,
  Clock,
  Plus,
  Flag,
  Cross,
  Egg,
  Briefcase,
  Church,
  Landmark,
  Star,
} from "lucide-react";
import { toast } from "sonner";

type CampaignDate = {
  key: string;
  name: string;
  dayMonth: string;
  icon: any;
  custom?: boolean;
};

const HOLIDAY_DATES: CampaignDate[] = [
  { key: "newyear", name: "Ano Novo", dayMonth: "01/01", icon: Sparkles },
  { key: "carnaval", name: "Carnaval", dayMonth: "17/02", icon: PartyPopper },
  { key: "womens", name: "Dia da Mulher", dayMonth: "08/03", icon: Sparkles },
  { key: "sextasanta", name: "Sexta-feira Santa", dayMonth: "03/04", icon: Cross },
  { key: "pascoa", name: "Páscoa", dayMonth: "05/04", icon: Egg },
  { key: "tiradentes", name: "Tiradentes", dayMonth: "21/04", icon: Flag },
  { key: "trabalho", name: "Dia do Trabalho", dayMonth: "01/05", icon: Briefcase },
  { key: "mothers", name: "Dia das Mães", dayMonth: "10/05", icon: Flower2 },
  { key: "corpuschristi", name: "Corpus Christi", dayMonth: "04/06", icon: Church },
  { key: "valentines", name: "Dia dos Namorados", dayMonth: "12/06", icon: Heart },
  { key: "saojoao", name: "São João", dayMonth: "24/06", icon: PartyPopper },
  { key: "fathers", name: "Dia dos Pais", dayMonth: "10/08", icon: Gift },
  { key: "independencia", name: "Independência do Brasil", dayMonth: "07/09", icon: Flag },
  { key: "childrens", name: "Dia das Crianças", dayMonth: "12/10", icon: Cake },
  { key: "proclamacao", name: "Proclamação da República", dayMonth: "15/11", icon: Landmark },
  { key: "consciencianegra", name: "Consciência Negra", dayMonth: "20/11", icon: Star },
  { key: "blackfriday", name: "Black Friday", dayMonth: "29/11", icon: Gift },
  { key: "christmas", name: "Natal", dayMonth: "25/12", icon: Gift },
  { key: "vesperaano", name: "Véspera de Ano Novo", dayMonth: "31/12", icon: Sparkles },
];

const sortByDate = (a: CampaignDate, b: CampaignDate) => {
  const [da, ma] = a.dayMonth.split("/").map(Number);
  const [db, mb] = b.dayMonth.split("/").map(Number);
  return ma === mb ? da - db : ma - mb;
};

type Preset = {
  id: string;
  date_name: string;
  day_month: string;
  message_text: string;
  image_url: string | null;
  target_audience: "Homens" | "Mulheres" | "Todos";
  save_preset: boolean;
  is_configured: boolean;
};

type SendState = {
  status: "idle" | "sending" | "paused" | "batch_pause" | "completed" | "error";
  total: number;
  sent: number;
  failed: number;
  currentName: string;
  nextDelay: number;
  batchPauseRemaining: number;
};

const BATCH_SIZE = 10;
const BATCH_PAUSE_MS = 10 * 60 * 1000; // 10 min
const MIN_DELAY = 8000;
const MAX_DELAY = 30000;

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return digits;
  return digits.startsWith("55") ? digits : `55${digits}`;
};

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    });
  });

export default function Campaigns() {
  const { effectiveCompanyId } = useAuth();
  const [presets, setPresets] = useState<Record<string, Preset>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<CampaignDate | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [sendingDate, setSendingDate] = useState<CampaignDate | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

  // Form state
  const [audience, setAudience] = useState<"Homens" | "Mulheres" | "Todos">("Todos");
  const [messageText, setMessageText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [savePreset, setSavePreset] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Send engine state
  const [send, setSend] = useState<SendState>({
    status: "idle",
    total: 0,
    sent: 0,
    failed: 0,
    currentName: "",
    nextDelay: 0,
    batchPauseRemaining: 0,
  });
  const abortRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);

  // Custom dates added by user (not in HOLIDAY_DATES)
  const [customDates, setCustomDates] = useState<CampaignDate[]>([]);
  const [newDateOpen, setNewDateOpen] = useState(false);
  const [newDateName, setNewDateName] = useState("");
  const [newDateDayMonth, setNewDateDayMonth] = useState("");

  const loadPresets = async () => {
    if (!effectiveCompanyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("campaign_presets" as any)
      .select("*")
      .eq("company_id", effectiveCompanyId);
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar campanhas");
    } else {
      const map: Record<string, Preset> = {};
      const customs: CampaignDate[] = [];
      (data as any[])?.forEach((p) => {
        const match = HOLIDAY_DATES.find(
          (h) => h.name === p.date_name || h.dayMonth === p.day_month
        );
        if (match) {
          map[match.key] = p as Preset;
        } else {
          const key = `custom_${p.id}`;
          map[key] = p as Preset;
          customs.push({
            key,
            name: p.date_name,
            dayMonth: p.day_month,
            icon: CalendarIcon,
            custom: true,
          });
        }
      });
      setCustomDates(customs);
      setPresets(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPresets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCompanyId]);

  const allDates = [...HOLIDAY_DATES, ...customDates].sort(sortByDate);

  const handleCreateNewDate = async () => {
    if (!newDateName.trim()) {
      toast.error("Informe o nome da data");
      return;
    }
    const dmMatch = newDateDayMonth.match(/^(\d{2})\/(\d{2})$/);
    if (!dmMatch) {
      toast.error("Use o formato DD/MM (ex: 25/12)");
      return;
    }
    const day = parseInt(dmMatch[1]);
    const month = parseInt(dmMatch[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) {
      toast.error("Data inválida");
      return;
    }
    if (!effectiveCompanyId) return;
    const { error } = await supabase
      .from("campaign_presets" as any)
      .insert({
        company_id: effectiveCompanyId,
        date_name: newDateName.trim(),
        day_month: newDateDayMonth,
        message_text: "",
        target_audience: "Todos",
        is_configured: false,
        save_preset: true,
      });
    if (error) {
      toast.error("Erro ao criar data: " + error.message);
      return;
    }
    toast.success("Data criada! Agora configure a mensagem.");
    setNewDateName("");
    setNewDateDayMonth("");
    setNewDateOpen(false);
    await loadPresets();
  };


  const openConfig = (date: CampaignDate) => {
    const existing = presets[date.key];
    setSelectedDate(date);
    setAudience(existing?.target_audience || "Todos");
    setMessageText(existing?.message_text || "");
    setImageUrl(existing?.image_url || null);
    setSavePreset(existing?.save_preset ?? true);
    setConfigOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!effectiveCompanyId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${effectiveCompanyId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("campaigns").upload(path, file, {
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("campaigns").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Imagem carregada");
    } catch (e: any) {
      toast.error("Erro ao enviar imagem: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDate || !effectiveCompanyId) return;
    if (!messageText.trim()) {
      toast.error("Escreva a mensagem da campanha");
      return;
    }
    setSaving(true);
    const existing = presets[selectedDate.key];
    const payload = {
      company_id: effectiveCompanyId,
      date_name: selectedDate.name,
      day_month: selectedDate.dayMonth,
      message_text: messageText,
      image_url: imageUrl,
      target_audience: audience,
      save_preset: savePreset,
      is_configured: true,
    };
    const { error } = existing
      ? await supabase.from("campaign_presets" as any).update(payload).eq("id", existing.id)
      : await supabase.from("campaign_presets" as any).insert(payload);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Campanha salva");
      setConfigOpen(false);
      loadPresets();
    }
    setSaving(false);
  };

  const startSending = async (date: CampaignDate) => {
    const preset = presets[date.key];
    if (!preset || !preset.is_configured) {
      toast.error("Configure a campanha primeiro");
      return;
    }
    if (!effectiveCompanyId) return;

    // Fetch API settings
    const { data: api } = await supabase
      .from("api_settings")
      .select("api_url, api_token, instance_name, uazapi_base_url")
      .eq("company_id", effectiveCompanyId)
      .maybeSingle();
    const baseUrl = api?.uazapi_base_url || api?.api_url;
    const token = api?.api_token;
    if (!baseUrl || !token) {
      toast.error("Configure a API do WhatsApp em Configurações > Instância");
      return;
    }

    // Fetch clients filtered by gender
    let q = supabase
      .from("clients")
      .select("id, name, whatsapp, phone, genero")
      .eq("company_id", effectiveCompanyId)
      .neq("status", "deleted");
    if (preset.target_audience === "Mulheres") q = q.eq("genero", "Feminino");
    else if (preset.target_audience === "Homens") q = q.eq("genero", "Masculino");

    const { data: clients, error } = await q;
    if (error || !clients) {
      toast.error("Erro ao carregar clientes");
      return;
    }
    const recipients = clients
      .map((c) => ({
        ...c,
        phone: normalizePhone(c.whatsapp || c.phone || ""),
      }))
      .filter((c) => c.phone.length >= 12);

    if (!recipients.length) {
      toast.error("Nenhum cliente válido encontrado para o filtro");
      return;
    }

    setSendingDate(date);
    setSendOpen(true);
    setSend({
      status: "sending",
      total: recipients.length,
      sent: 0,
      failed: 0,
      currentName: "",
      nextDelay: 0,
      batchPauseRemaining: 0,
    });

    abortRef.current = new AbortController();
    pauseRef.current = false;
    const signal = abortRef.current.signal;

    let sent = 0;
    let failed = 0;

    try {
      for (let i = 0; i < recipients.length; i++) {
        if (signal.aborted) break;

        // Pause check
        while (pauseRef.current && !signal.aborted) {
          setSend((s) => ({ ...s, status: "paused" }));
          await sleep(500);
        }
        if (signal.aborted) break;

        const r = recipients[i];
        setSend((s) => ({
          ...s,
          status: "sending",
          currentName: r.name,
          nextDelay: 0,
        }));

        const personalized = preset.message_text.replace(/\{nome\}/gi, r.name.split(" ")[0]);

        try {
          const endpoint = preset.image_url ? "/send/media" : "/send/text";
          const body: any = preset.image_url
            ? {
                number: r.phone,
                type: "image",
                file: preset.image_url,
                text: personalized,
              }
            : { number: r.phone, text: personalized };

          const res = await fetch(`${baseUrl.replace(/\/$/, "")}${endpoint}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              token,
            },
            body: JSON.stringify(body),
            signal,
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          sent++;
        } catch (e) {
          console.error("Send failed:", e);
          failed++;
        }

        setSend((s) => ({ ...s, sent, failed }));

        // Batch pause
        if ((i + 1) % BATCH_SIZE === 0 && i + 1 < recipients.length) {
          const start = Date.now();
          while (Date.now() - start < BATCH_PAUSE_MS && !signal.aborted) {
            const remaining = Math.max(0, BATCH_PAUSE_MS - (Date.now() - start));
            setSend((s) => ({
              ...s,
              status: "batch_pause",
              batchPauseRemaining: Math.ceil(remaining / 1000),
            }));
            await sleep(1000, signal).catch(() => {});
            if (pauseRef.current) {
              while (pauseRef.current && !signal.aborted) await sleep(500);
            }
          }
        } else if (i + 1 < recipients.length) {
          // Random delay 8-30s
          const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
          const start = Date.now();
          while (Date.now() - start < delay && !signal.aborted) {
            const remaining = Math.max(0, delay - (Date.now() - start));
            setSend((s) => ({ ...s, nextDelay: Math.ceil(remaining / 1000) }));
            await sleep(500, signal).catch(() => {});
          }
        }
      }
      setSend((s) => ({ ...s, status: "completed" }));
      toast.success(`Campanha finalizada: ${sent} enviados, ${failed} falhas`);
    } catch (e: any) {
      setSend((s) => ({ ...s, status: "error" }));
      toast.error("Erro: " + e.message);
    }
  };

  const togglePause = () => {
    pauseRef.current = !pauseRef.current;
    setSend((s) => ({ ...s, status: pauseRef.current ? "paused" : "sending" }));
  };

  const stopSending = () => {
    abortRef.current?.abort();
    setSend((s) => ({ ...s, status: "idle" }));
    setSendOpen(false);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
            <CalendarIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Campanhas Comemorativas</h1>
            <p className="text-sm text-muted-foreground">
              Configure mensagens para datas especiais e dispare com inteligência anti-ban
            </p>
          </div>
        </div>
        <Button
          onClick={() => setNewDateOpen(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-1" />
          Nova Campanha
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allDates.map((date) => {
          const preset = presets[date.key];
          const Icon = date.icon;
          return (
            <Card
              key={date.key}
              className="p-5 backdrop-blur-xl bg-card/60 border-border/50 hover:border-primary/40 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                {preset?.is_configured ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Configurado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <Circle className="w-3 h-3 mr-1" />
                    Pendente
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-lg">{date.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{date.dayMonth}</p>
              {preset?.is_configured && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  Público: {preset.target_audience}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openConfig(date)}
                  className="flex-1"
                >
                  <Settings2 className="w-4 h-4 mr-1" />
                  Configurar
                </Button>
                {preset?.is_configured && (
                  <Button
                    size="sm"
                    onClick={() => startSending(date)}
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Disparar
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Config Modal */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg backdrop-blur-xl bg-card/95">
          <DialogHeader>
            <DialogTitle>Configurar: {selectedDate?.name}</DialogTitle>
            <DialogDescription>
              Defina público, mensagem e imagem desta campanha
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                Público-alvo
              </Label>
              <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos os clientes</SelectItem>
                  <SelectItem value="Mulheres">Apenas Mulheres</SelectItem>
                  <SelectItem value="Homens">Apenas Homens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <ImageIcon className="w-4 h-4" />
                Imagem da campanha
              </Label>
              {imageUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={imageUrl} alt="preview" className="w-full max-h-48 object-cover" />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => setImageUrl(null)}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "Enviando..." : "Clique para enviar imagem"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                    }}
                  />
                </label>
              )}
            </div>

            <div>
              <Label className="mb-2 block">
                Mensagem (use <code className="text-primary">{"{nome}"}</code> para personalizar)
              </Label>
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Olá {nome}, hoje é um dia especial..."
                rows={5}
              />
              {imageUrl && (
                <p className="text-xs text-muted-foreground mt-1">
                  Esta mensagem será enviada como legenda da imagem.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="save-preset"
                checked={savePreset}
                onCheckedChange={(v) => setSavePreset(!!v)}
              />
              <Label htmlFor="save-preset" className="cursor-pointer text-sm">
                Salvar como predefinição para os próximos anos
              </Label>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setConfigOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sending Monitor Modal */}
      <Dialog open={sendOpen} onOpenChange={(o) => !o && send.status === "idle" && setSendOpen(false)}>
        <DialogContent className="max-w-md backdrop-blur-xl bg-card/95">
          <DialogHeader>
            <DialogTitle>Disparando: {sendingDate?.name}</DialogTitle>
            <DialogDescription>
              Sistema anti-ban com lotes de {BATCH_SIZE} e pausas de 10 minutos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-semibold">
                  {send.sent + send.failed} / {send.total}
                </span>
              </div>
              <Progress
                value={send.total ? ((send.sent + send.failed) / send.total) * 100 : 0}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-2xl font-bold text-emerald-400">{send.sent}</div>
                <div className="text-xs text-muted-foreground">Enviados</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-400">{send.failed}</div>
                <div className="text-xs text-muted-foreground">Falhas</div>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="text-2xl font-bold text-primary">
                  {send.total - send.sent - send.failed}
                </div>
                <div className="text-xs text-muted-foreground">Restam</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              {send.status === "sending" && (
                <div className="font-medium flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Enviando para {send.currentName}...
                  {send.nextDelay > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Próximo em {send.nextDelay}s
                    </span>
                  )}
                </div>
              )}
              {send.status === "paused" && (
                <div className="font-medium flex items-center gap-2 text-amber-400">
                  <Pause className="w-4 h-4" />
                  Pausado
                </div>
              )}
              {send.status === "batch_pause" && (
                <div className="font-medium flex items-center gap-2 text-cyan-400">
                  <Clock className="w-4 h-4" />
                  Pausa de lote: {formatTime(send.batchPauseRemaining)}
                </div>
              )}
              {send.status === "completed" && (
                <div className="font-medium flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Campanha finalizada!
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              {(send.status === "sending" || send.status === "batch_pause") && (
                <Button variant="outline" onClick={togglePause}>
                  <Pause className="w-4 h-4 mr-1" />
                  Pausar
                </Button>
              )}
              {send.status === "paused" && (
                <Button variant="outline" onClick={togglePause}>
                  <Play className="w-4 h-4 mr-1" />
                  Retomar
                </Button>
              )}
              {send.status !== "completed" && send.status !== "idle" && (
                <Button variant="destructive" onClick={stopSending}>
                  <Square className="w-4 h-4 mr-1" />
                  Parar
                </Button>
              )}
              {send.status === "completed" && (
                <Button onClick={() => setSendOpen(false)}>Fechar</Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

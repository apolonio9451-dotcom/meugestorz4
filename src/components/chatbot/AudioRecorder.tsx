import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, Square, Loader2, Save, Trash2, Play, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AudioRecorderProps {
  companyId: string;
  onUploaded: () => void;
}

export default function AudioRecorder({ companyId, onUploaded }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use webm for recording (broadly supported), will be stored as-is
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start(250);
      setRecording(true);
      setDuration(0);
      setAudioBlob(null);
      setAudioUrl(null);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      toast({
        title: "Erro ao acessar microfone",
        description: err?.message || "Permissão de microfone negada.",
        variant: "destructive",
      });
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const handlePlayPreview = () => {
    if (!audioPreviewRef.current || !audioUrl) return;
    if (playing) {
      audioPreviewRef.current.pause();
      setPlaying(false);
    } else {
      audioPreviewRef.current.src = audioUrl;
      audioPreviewRef.current.play();
      setPlaying(true);
    }
  };

  const handleDiscard = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setFileName("");
    setDuration(0);
    setPlaying(false);
  };

  const handleSave = async () => {
    if (!audioBlob || !companyId) return;
    const name = fileName.trim() || `gravacao_${Date.now()}`;
    const ext = audioBlob.type.includes("mp4") ? "mp4" : "ogg";
    const fullName = name.endsWith(`.${ext}`) ? name : `${name}.${ext}`;

    setSaving(true);
    try {
      const path = `${companyId}/${Date.now()}_${fullName}`;
      const { error: uploadError } = await supabase.storage
        .from("chatbot-media")
        .upload(path, audioBlob, { contentType: audioBlob.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chatbot-media").getPublicUrl(path);
      const { error: dbError } = await supabase.from("chatbot_media").insert({
        company_id: companyId,
        file_name: fullName,
        file_url: urlData.publicUrl,
        file_type: "audio",
        file_size: audioBlob.size,
      });
      if (dbError) throw dbError;

      toast({ title: "🎙️ Áudio gravado e salvo com sucesso!" });
      handleDiscard();
      onUploaded();
    } catch (err: any) {
      toast({ title: "Erro ao salvar áudio", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-4">
      <audio
        ref={audioPreviewRef}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />

      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Gravador de Áudio</span>
      </div>

      {!audioBlob ? (
        <div className="flex items-center gap-4">
          {recording ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm font-mono text-destructive font-semibold">
                  {formatTime(duration)}
                </span>
                <span className="text-xs text-muted-foreground">Gravando...</span>
              </div>
              <Button variant="destructive" size="sm" onClick={stopRecording}>
                <Square className="w-3.5 h-3.5 mr-1" />
                Parar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={startRecording}>
              <Mic className="w-3.5 h-3.5 mr-1" />
              Iniciar Gravação
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePlayPreview}>
              {playing ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4" />}
            </Button>
            <span className="text-sm text-muted-foreground">
              Duração: {formatTime(duration)} • {(audioBlob.size / 1024).toFixed(0)} KB
            </span>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Nome do arquivo</Label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Ex: pagamento, boas-vindas, suporte..."
                className="h-8 text-sm bg-background/50"
              />
              <p className="text-[10px] text-muted-foreground">
                Use este nome como tag: <code className="text-primary">[AUDIO:{fileName || "nome"}]</code>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleDiscard}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Descartar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Grave áudios diretamente pelo navegador. Use na personalidade: <code className="text-primary">[AUDIO:nome]</code> para a IA enviar automaticamente.
      </p>
    </div>
  );
}

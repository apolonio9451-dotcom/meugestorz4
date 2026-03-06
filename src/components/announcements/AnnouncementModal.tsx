import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
}

export default function AnnouncementModal() {
  const { user, companyId, parentCompanyId } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const todayKey = `announcements_seen_${user.id}_${new Date().toISOString().slice(0, 10)}`;

    // Already seen today
    if (localStorage.getItem(todayKey)) return;

    const fetchAnnouncements = async () => {
      const queries = [];
      
      if (companyId) {
        queries.push(
          supabase
            .from("system_announcements")
            .select("id, title, message")
            .eq("company_id", companyId)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
        );
      }

      // For resellers: also fetch announcements from parent company
      if (parentCompanyId && parentCompanyId !== companyId) {
        queries.push(
          supabase
            .from("system_announcements")
            .select("id, title, message")
            .eq("company_id", parentCompanyId)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
        );
      }

      const results = await Promise.all(queries);
      const allAnnouncements = results.flatMap((r) => (r.data as Announcement[]) || []);

      // Deduplicate by id
      const unique = Array.from(new Map(allAnnouncements.map((a) => [a.id, a])).values());

      if (unique.length > 0) {
        setAnnouncements(unique);
        setCurrentIndex(0);
        setOpen(true);
      }
    };

    // Small delay to let auth settle
    const timer = setTimeout(fetchAnnouncements, 1500);
    return () => clearTimeout(timer);
  }, [user, companyId, parentCompanyId]);

  const handleClose = () => {
    if (currentIndex < announcements.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setOpen(false);
      if (user) {
        const todayKey = `announcements_seen_${user.id}_${new Date().toISOString().slice(0, 10)}`;
        localStorage.setItem(todayKey, "true");
      }
    }
  };

  if (announcements.length === 0) return null;

  const current = announcements[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md rounded-2xl border-primary/20">
        <DialogHeader className="text-center items-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-lg">{current?.title}</DialogTitle>
          <DialogDescription className="sr-only">Aviso do sistema</DialogDescription>
        </DialogHeader>
        <div className="text-sm text-muted-foreground whitespace-pre-wrap text-center px-2">
          {current?.message}
        </div>
        {announcements.length > 1 && (
          <p className="text-center text-[10px] text-muted-foreground">
            {currentIndex + 1} de {announcements.length}
          </p>
        )}
        <DialogFooter className="sm:justify-center">
          <Button onClick={handleClose} className="min-w-[120px]">
            {currentIndex < announcements.length - 1 ? "Próximo" : "Entendido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

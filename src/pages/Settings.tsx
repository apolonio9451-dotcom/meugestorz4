import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon, Wifi, Shield, Server, Bell, User } from "lucide-react";
import WhatsAppView from "@/components/whatsapp/WhatsAppView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Settings() {
  const { effectiveCompanyId: companyId, userRole, effectivePlanType, loading } = useAuth();
  const isOwner = userRole === "Proprietário";
  const isMaster = userRole === "master";
  const canManageApiSettings = isOwner || isMaster;
  const hasInstanceAccess = loading ? true : (canManageApiSettings || effectivePlanType === "pro");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground text-sm">
          Gerencie as preferências e integrações da sua conta
        </p>
      </div>

      <Tabs defaultValue="whatsapp" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:w-[600px] mb-8">
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          {hasInstanceAccess ? (
            <WhatsAppView />
          ) : (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-destructive" />
                  Acesso Restrito
                </CardTitle>
                <CardDescription>
                  O módulo de WhatsApp requer um plano superior.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Sua conta atual não possui acesso às configurações de instância do WhatsApp. 
                  Entre em contato com o suporte ou faça o upgrade para o plano PRO.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Perfil</CardTitle>
              <CardDescription>Gerencie suas informações pessoais e de exibição</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">Em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>Escolha como deseja ser avisado sobre eventos importantes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">Em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Segurança da Conta</CardTitle>
              <CardDescription>Proteja seu acesso com autenticação e senhas fortes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic">Em desenvolvimento...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

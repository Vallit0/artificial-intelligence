import { useState } from "react";
import { useLtiPlatforms, LtiPlatform } from "@/hooks/useLtiPlatforms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, ChevronDown, ChevronUp, Edit, GraduationCap, Loader2, Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EMPTY_FORM = {
  name: "",
  issuerUrl: "",
  clientId: "",
  authEndpoint: "",
  tokenEndpoint: "",
  jwksUrl: "",
  deploymentId: "",
};

export default function LtiPlatformPanel() {
  const { platforms, isLoading, createPlatform, updatePlatform, deletePlatform } = useLtiPlatforms();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.issuerUrl || !form.clientId) {
      toast({ title: "Error", description: "Name, Issuer URL y Client ID son requeridos.", variant: "destructive" });
      return;
    }
    setSaving(true);
    let success: boolean;
    if (editingId) {
      success = await updatePlatform(editingId, form);
    } else {
      success = await createPlatform(form);
    }
    setSaving(false);
    if (success) {
      toast({ title: editingId ? "Actualizado" : "Creado", description: `Plataforma "${form.name}" guardada.` });
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  };

  const handleEdit = (p: LtiPlatform) => {
    setForm({
      name: p.name,
      issuerUrl: p.issuerUrl,
      clientId: p.clientId,
      authEndpoint: p.authEndpoint,
      tokenEndpoint: p.tokenEndpoint,
      jwksUrl: p.jwksUrl,
      deploymentId: p.deploymentId,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (p: LtiPlatform) => {
    const success = await deletePlatform(p.id);
    if (success) toast({ title: "Eliminado", description: `Plataforma "${p.name}" eliminada.` });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Moodle Setup Guide */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowGuide(!showGuide)}
        >
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Guia de Configuracion en Moodle
            </div>
            {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {showGuide && (
          <CardContent className="text-sm space-y-3">
            <p className="font-semibold">En Moodle:</p>
            <ol className="list-decimal ml-5 space-y-2 text-muted-foreground">
              <li>Ve a <strong>Site administration &gt; Plugins &gt; Activity modules &gt; External tool &gt; Manage tools</strong></li>
              <li>Click en <strong>"Configure a tool manually"</strong></li>
              <li>Llena los campos:
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li><strong>Tool name:</strong> Senoriales</li>
                  <li><strong>Tool URL:</strong> <code className="bg-muted px-1 rounded">{window.location.origin}/lti/launch</code></li>
                  <li><strong>LTI version:</strong> LTI 1.3</li>
                  <li><strong>Initiate login URL:</strong> <code className="bg-muted px-1 rounded">{window.location.origin}/lti/initiate</code></li>
                  <li><strong>Redirection URI(s):</strong> <code className="bg-muted px-1 rounded">{window.location.origin}/lti/launch</code></li>
                </ul>
              </li>
              <li>Guarda en Moodle. Copia los datos generados:
                <strong> Platform ID (issuer), Client ID, Auth URL, Token URL, Keyset URL, Deployment ID</strong>
              </li>
              <li>Regresa aqui y registra la plataforma con esos datos.</li>
            </ol>
            <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="font-medium text-primary">URLs de tu servidor:</p>
              <p className="text-xs font-mono mt-1">Launch URL: {window.location.origin}/lti/launch</p>
              <p className="text-xs font-mono">Login URL: {window.location.origin}/lti/initiate</p>
              <p className="text-xs font-mono">Info URL: {window.location.origin}/lti/info</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Platform List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Plataformas LTI Registradas
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setForm(EMPTY_FORM);
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nueva Plataforma
          </Button>
        </CardHeader>
        <CardContent>
          {platforms.length === 0 && !showForm ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay plataformas LTI registradas. Agrega una para conectar con Moodle.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Issuer URL</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {platforms.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-xs font-mono truncate max-w-48">{p.issuerUrl}</TableCell>
                    <TableCell className="text-xs font-mono">{p.clientId}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(p)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Add/Edit Form */}
          {showForm && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{editingId ? "Editar" : "Nueva"} Plataforma</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setShowForm(false); setEditingId(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Moodle USAC" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Issuer URL *</label>
                  <Input value={form.issuerUrl} onChange={(e) => setForm({ ...form, issuerUrl: e.target.value })} placeholder="https://moodle.example.com" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Client ID *</label>
                  <Input value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="abc123" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Deployment ID</label>
                  <Input value={form.deploymentId} onChange={(e) => setForm({ ...form, deploymentId: e.target.value })} placeholder="1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Auth Endpoint</label>
                  <Input value={form.authEndpoint} onChange={(e) => setForm({ ...form, authEndpoint: e.target.value })} placeholder="https://moodle.example.com/mod/lti/auth.php" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Token Endpoint</label>
                  <Input value={form.tokenEndpoint} onChange={(e) => setForm({ ...form, tokenEndpoint: e.target.value })} placeholder="https://moodle.example.com/mod/lti/token.php" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-muted-foreground">JWKS URL</label>
                  <Input value={form.jwksUrl} onChange={(e) => setForm({ ...form, jwksUrl: e.target.value })} placeholder="https://moodle.example.com/mod/lti/certs.php" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {editingId ? "Actualizar" : "Crear"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

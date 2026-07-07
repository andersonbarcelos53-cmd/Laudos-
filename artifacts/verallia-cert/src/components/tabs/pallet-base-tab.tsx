import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPalletQuantities,
  useImportPalletQuantities,
  useAddPalletQuantity,
  useUpdatePalletQuantity,
  useDeletePalletQuantity,
  getListPalletQuantitiesQueryKey,
  getGetStatsQueryKey,
} from "@workspace/api-client-react";
import type { PalletQuantity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Loader2, Upload, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

type PalletForm = { sapCode: string; productName: string; piecesPerPallet: string };
const emptyForm: PalletForm = { sapCode: "", productName: "", piecesPerPallet: "" };

export function PalletBaseTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PalletQuantity | null>(null);
  const [form, setForm] = useState<PalletForm>(emptyForm);

  const { data: pallets = [], isLoading } = useListPalletQuantities();
  const importMutation = useImportPalletQuantities();
  const addMutation = useAddPalletQuantity();
  const updateMutation = useUpdatePalletQuantity();
  const deleteMutation = useDeletePalletQuantity();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListPalletQuantitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsQueryKey() });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importMutation.mutate(
      { data: { file } },
      {
        onSuccess: (res) => {
          toast({ title: "Importação Concluída", description: res.message ?? `${res.imported} registros importados.` });
          invalidate();
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: () => {
          toast({ title: "Erro na Importação", description: "Erro ao importar o arquivo Excel.", variant: "destructive" });
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
      }
    );
  };

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: PalletQuantity) => {
    setEditTarget(row);
    setForm({ sapCode: row.sapCode, productName: row.productName ?? "", piecesPerPallet: String(row.piecesPerPallet) });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const piecesPerPallet = Number(form.piecesPerPallet);
    if (!form.sapCode.trim() || isNaN(piecesPerPallet) || piecesPerPallet <= 0) {
      toast({ title: "Dados inválidos", description: "Preencha o código SAP e a quantidade de peças por pallet.", variant: "destructive" });
      return;
    }

    if (editTarget) {
      updateMutation.mutate(
        {
          id: editTarget.id,
          data: { sapCode: form.sapCode.trim(), productName: form.productName.trim() || undefined, piecesPerPallet },
        },
        {
          onSuccess: () => {
            toast({ title: "Atualizado", description: "Registro atualizado com sucesso." });
            setDialogOpen(false);
            invalidate();
          },
          onError: () => toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" }),
        }
      );
    } else {
      addMutation.mutate(
        { data: { sapCode: form.sapCode.trim(), productName: form.productName.trim() || undefined, piecesPerPallet } },
        {
          onSuccess: () => {
            toast({ title: "Adicionado", description: "Produto adicionado à base de pallets." });
            setDialogOpen(false);
            invalidate();
          },
          onError: (err) => {
            const msg = (err as { data?: { error?: string } }).data?.error ?? "Não foi possível adicionar.";
            toast({ title: "Erro", description: msg, variant: "destructive" });
          },
        }
      );
    }
  };

  const handleDelete = (row: PalletQuantity) => {
    if (!window.confirm(`Excluir SAP ${row.sapCode} da base de pallets?`)) return;
    deleteMutation.mutate(
      { id: row.id },
      {
        onSuccess: () => {
          toast({ title: "Excluído", description: `SAP ${row.sapCode} removido.` });
          invalidate();
        },
        onError: () => toast({ title: "Erro", description: "Não foi possível excluir.", variant: "destructive" }),
      }
    );
  };

  const isSaving = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Base de Peças por Pallet</CardTitle>
            <CardDescription>
              {pallets.length} registro(s) — Gerencie a quantidade padrão de peças por pallet para cada código SAP.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importMutation.isPending} data-testid="button-import-excel">
              {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Importar Excel
            </Button>
            <Button onClick={openAdd} data-testid="button-add-pallet">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Cód. SAP</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Peças / Pallet</TableHead>
                  <TableHead className="text-right">Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : pallets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                        <FileSpreadsheet className="w-8 h-8 opacity-20" />
                        <p>Nenhum registro. Importe uma planilha ou adicione manualmente.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pallets.map((pallet) => (
                    <TableRow key={pallet.id} data-testid={`row-pallet-${pallet.id}`}>
                      <TableCell className="font-mono font-medium">{pallet.sapCode}</TableCell>
                      <TableCell>{pallet.productName || "-"}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {pallet.piecesPerPallet.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {formatDate(pallet.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            data-testid={`button-edit-pallet-${pallet.id}`}
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(pallet)}
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            data-testid={`button-delete-pallet-${pallet.id}`}
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(pallet)}
                            disabled={deleteMutation.isPending}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Editar Produto" : "Adicionar Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dialog-sap">Código SAP</Label>
              <Input
                id="dialog-sap"
                data-testid="input-dialog-sap"
                value={form.sapCode}
                onChange={(e) => setForm((f) => ({ ...f, sapCode: e.target.value }))}
                placeholder="Ex: 9070854"
                disabled={!!editTarget}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-product">Nome do Produto</Label>
              <Input
                id="dialog-product"
                data-testid="input-dialog-product"
                value={form.productName}
                onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                placeholder="Ex: GFA. CIDADE IMPERIAL 300 (opcional)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-pieces">Peças por Pallet</Label>
              <Input
                id="dialog-pieces"
                data-testid="input-dialog-pieces"
                type="number"
                min="1"
                value={form.piecesPerPallet}
                onChange={(e) => setForm((f) => ({ ...f, piecesPerPallet: e.target.value }))}
                placeholder="Ex: 3300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isSaving} data-testid="button-dialog-save">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editTarget ? "Salvar Alterações" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

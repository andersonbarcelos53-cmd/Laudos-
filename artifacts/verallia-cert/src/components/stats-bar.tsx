import { useGetStats } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { FileText, Database, History, Package } from "lucide-react";

export function StatsBar() {
  const { data: stats, isLoading } = useGetStats();

  if (isLoading || !stats) {
    return <div className="h-[88px] w-full animate-pulse bg-muted rounded-lg border border-border mb-6" />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary shadow-sm rounded-md">
        <div className="p-2 bg-primary/10 rounded text-primary">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Certificados</p>
          <p className="text-2xl font-bold leading-none mt-1">{stats.totalCertificates}</p>
        </div>
      </Card>
      
      <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary shadow-sm rounded-md">
        <div className="p-2 bg-primary/10 rounded text-primary">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Códigos SAP</p>
          <p className="text-2xl font-bold leading-none mt-1">{stats.totalSapCodes}</p>
        </div>
      </Card>
      
      <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary shadow-sm rounded-md">
        <div className="p-2 bg-primary/10 rounded text-primary">
          <Package className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Base Pallets</p>
          <p className="text-2xl font-bold leading-none mt-1">{stats.totalPalletEntries}</p>
        </div>
      </Card>
      
      <Card className="p-4 flex items-center gap-4 border-l-4 border-l-primary shadow-sm rounded-md">
        <div className="p-2 bg-primary/10 rounded text-primary">
          <History className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Histórico</p>
          <p className="text-2xl font-bold leading-none mt-1">{stats.totalHistoryRecords}</p>
        </div>
      </Card>
    </div>
  );
}

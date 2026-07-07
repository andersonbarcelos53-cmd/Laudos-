import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsBar } from "@/components/stats-bar";
import { UploadTab } from "@/components/tabs/upload-tab";
import { PalletBaseTab } from "@/components/tabs/pallet-base-tab";
import { FillCertificateTab } from "@/components/tabs/fill-certificate-tab";
import { HistoryTab } from "@/components/tabs/history-tab";
import { ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-2 rounded">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Verallia Certificados</h1>
          </div>
          <div className="text-xs text-muted-foreground text-right leading-tight">
            <span className="font-medium">Desenvolvido por:</span>
            <br />
            Creverson Souza, Anderson Barcelos
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <StatsBar />

        <Tabs defaultValue="fill" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 rounded-lg p-1 h-12 bg-muted/50 border">
            <TabsTrigger value="upload" className="font-medium">Upload de PDFs</TabsTrigger>
            <TabsTrigger value="pallets" className="font-medium">Base Peças/Pallet</TabsTrigger>
            <TabsTrigger value="fill" className="font-medium">Preencher Certificado</TabsTrigger>
            <TabsTrigger value="history" className="font-medium">Histórico</TabsTrigger>
          </TabsList>
          
          <div className="mt-4">
            <TabsContent value="upload" className="m-0 focus-visible:outline-none">
              <UploadTab />
            </TabsContent>
            
            <TabsContent value="pallets" className="m-0 focus-visible:outline-none">
              <PalletBaseTab />
            </TabsContent>
            
            <TabsContent value="fill" className="m-0 focus-visible:outline-none">
              <FillCertificateTab />
            </TabsContent>
            
            <TabsContent value="history" className="m-0 focus-visible:outline-none">
              <HistoryTab />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

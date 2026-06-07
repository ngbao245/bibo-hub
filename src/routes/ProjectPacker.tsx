import { Link } from 'react-router-dom';
import { ArrowLeft, PackagePlus, PackageOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import PackPanel from '@/components/packer/PackPanel';
import UnpackPanel from '@/components/packer/UnpackPanel';

// ============================================================
// ProjectPacker - page có 2 tab: Đóng gói / Giải nén
// ============================================================

export default function ProjectPacker() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-base font-semibold text-foreground">Project Packer</h1>
            <p className="text-xs text-muted-foreground">
              Đóng gói project thành text để paste qua chat
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-4xl">
          <Tabs defaultValue="pack">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pack" className="gap-1.5">
                <PackagePlus className="h-4 w-4" />
                Đóng gói
              </TabsTrigger>
              <TabsTrigger value="unpack" className="gap-1.5">
                <PackageOpen className="h-4 w-4" />
                Giải nén
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pack" className="mt-4">
              <PackPanel />
            </TabsContent>

            <TabsContent value="unpack" className="mt-4">
              <UnpackPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

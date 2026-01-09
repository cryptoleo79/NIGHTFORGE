import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, Server, Wifi, WifiOff, Wallet, RefreshCw } from "lucide-react";
import { MidnightWallet } from "@/modules/midnight/wallet-widget/ui/midnightWallet";
import { useContext } from "react";
import { WalletContext } from "@/modules/midnight/wallet-widget/contexts/wallet";

export function WalletUI() {
  const {
    status,
    walletInfo,
    wallet,
    disconnect,
    checkStatus,
  } = useContext(WalletContext);

  const isConnected = status === 'connected';

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Wallet Dashboard
          </h1>
          <p className="text-slate-400">
            Manage your wallet and view connection details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column */}
        <div className="space-y-6">
          <Card className="bg-slate-900/80 border-cyan-900/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Wallet Management
              </CardTitle>
              <CardDescription>
                Connect your wallet and view addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-6">
                <div className="flex-1 flex items-center justify-center">
                  <MidnightWallet />
                </div>
                <div className="flex flex-col gap-2 border-l pl-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">
                    Actions
                  </h4>
                  <Button
                    variant="outline"
                    onClick={disconnect}
                    disabled={!isConnected}
                    className="gap-2 h-7 text-xs w-full"
                  >
                    <Link2 className="h-3 w-3" />
                    Disconnect
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => checkStatus()}
                    className="gap-2 h-7 text-xs w-full"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-medium">Wallet Information</h4>

                <div className="space-y-2">
                  <div className="bg-muted px-3 py-2 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">
                      Unshielded Address
                    </div>
                    <div className="text-sm font-mono break-all">
                      {walletInfo?.unshieldedAddress || "Not connected"}
                    </div>
                  </div>

                  <div className="bg-muted px-3 py-2 rounded-md">
                    <div className="text-xs text-muted-foreground mb-1">
                      Shielded Address
                    </div>
                    <div className="text-sm font-mono break-all">
                      {walletInfo?.shieldedAddress || "Not connected"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted px-3 py-2 rounded-md">
                      <div className="text-xs text-muted-foreground mb-1">
                        Shielded Balance
                      </div>
                      <div className="text-sm font-mono">
                        {walletInfo?.shieldedBalance || "Not connected"}
                      </div>
                    </div>
                    <div className="bg-muted px-3 py-2 rounded-md">
                      <div className="text-xs text-muted-foreground mb-1">
                        Unshielded Balance
                      </div>
                      <div className="text-sm font-mono">
                        {walletInfo?.unshieldedBalance || "Not connected"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Connection Details */}
        <Card className="bg-slate-900/80 border-cyan-900/30 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Connection Details
            </CardTitle>
            <CardDescription>Network and connection status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Wallet Status</h3>
                <div className="flex items-center gap-2 text-sm">
                  <div
                    className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-gray-500"}`}
                  />
                  {isConnected ? "Connected" : status === 'connecting' ? "Connecting..." : "Disconnected"}
                </div>
                {isConnected && walletInfo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground ml-4">
                    <Server className="h-3 w-3" />
                    Network: {walletInfo.network}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground ml-4">
                  <Wallet className="h-3 w-3" />
                  Wallet Type: {walletInfo?.type || "Not connected"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Proof Server</h3>
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? (
                  <>
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-4 w-4 text-red-500" />
                    <span>Offline</span>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">Network Endpoints</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-50" />
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Indexer
                    </div>
                    <div className="truncate">
                      {wallet?.config?.indexerUri || "https://indexer.preview.midnight.network/api/v1/graphql"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-50" />
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Node
                    </div>
                    <div className="truncate">
                      {wallet?.config?.substrateNodeUri || "wss://rpc.preview.midnight.network"}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Server className="h-4 w-4 mt-0.5 flex-shrink-0 opacity-50" />
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Proof Server
                    </div>
                    <div className="truncate">
                      {wallet?.config?.proverServerUri || "https://prover.preview.midnight.network"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

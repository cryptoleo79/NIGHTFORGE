import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./common/dropdown-menu";
import { Button } from "./common/button";
import { useWallet } from "../hooks/useWallet";

export default function ConnectedButton() {
  const { disconnect, walletInfo } = useWallet();
  const address = walletInfo?.unshieldedAddress || walletInfo?.shieldedAddress;

  return (
    <>
      {address && address !== 'Not available' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {address.slice(0, 6)}...{address.slice(-4)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                navigator.clipboard.writeText(address);
              }}
            >
              Copy Address
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                disconnect();
              }}
            >
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}

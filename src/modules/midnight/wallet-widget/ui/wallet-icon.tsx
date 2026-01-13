import { Tooltip, TooltipContent, TooltipTrigger } from "./common/tooltip";

// Safely handles both data URLs and regular URLs
const safeIconUrl = (iconUrl?: string): string | undefined => {
  if (!iconUrl) return undefined;

  // Data URLs are already safe to use directly
  if (iconUrl.startsWith('data:')) {
    return iconUrl;
  }

  // For regular URLs, validate before returning
  try {
    new URL(iconUrl);
    return iconUrl;
  } catch {
    console.warn(`Invalid icon URL: ${iconUrl}`);
    return undefined;
  }
};

export default function WalletIcon({
  icon,
  name,
  action,
  iconReactNode,
}: {
  icon?: string;
  name: string;
  action: () => void;
  iconReactNode?: React.ReactNode;
}) {
  const safeIcon = safeIconUrl(icon);

  return (
    <Tooltip delayDuration={0} defaultOpen={false}>
      <TooltipTrigger asChild>
        <button
          className="flex items-center justify-center rounded-lg w-10 h-10 border border-zinc-700 hover:border-zinc-200 cursor-pointer"
          onClick={action}
        >
          {safeIcon && <img src={safeIcon} alt={name} className="w-8 h-8" />}
          {iconReactNode && iconReactNode}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{name}</p>
      </TooltipContent>
    </Tooltip>
  );
}

"use client";

// AI Elements Conversation, restyled: keeps the newest message in view while Lens
// streams, without moving the page.
import { ArrowDown } from "lucide-react";
import type { ComponentProps } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export const Conversation = ({ className, ...props }: ConversationProps) => <StickToBottom className={cn("relative min-h-0 flex-1 overflow-y-hidden", className)} initial="instant" resize="smooth" role="log" {...props} />;

export const ConversationContent = ({ className, ...props }: ComponentProps<typeof StickToBottom.Content>) => <StickToBottom.Content className={cn("flex flex-col gap-4 p-4", className)} {...props} />;

export const ConversationScrollButton = ({ className, ...props }: ComponentProps<typeof Button>) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  return (
    !isAtBottom && (
      <Button
        className={cn("absolute bottom-3 left-1/2 -translate-x-1/2 shadow-float", className)}
        onClick={() => scrollToBottom()}
        size="icon-sm"
        variant="outline"
        aria-label="Scroll to the latest message"
        {...props}
      >
        <ArrowDown aria-hidden />
      </Button>
    )
  );
};

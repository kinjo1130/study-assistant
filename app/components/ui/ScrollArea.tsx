interface ScrollAreaProps {
  className?: string;
  children: React.ReactNode;
}

export function ScrollArea({ className = '', children }: ScrollAreaProps) {
  return (
    <div className={`relative overflow-auto ${className}`}>
      <div className="h-full w-full">
        {children}
      </div>
    </div>
  );
}
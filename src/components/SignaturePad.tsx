import React, { useRef, useEffect, useState } from 'react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  height?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, height = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(canvas);

    return () => resizeObserver.disconnect();
  }, []);

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    const { x, y } = getPointerPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const { x, y } = getPointerPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDrawing = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e && e.cancelable) e.preventDefault();
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasContent(true);
    // Intentionally NOT calling onSave here — user must confirm explicitly.
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasContent(false);
    }
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (canvas && hasContent) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="relative w-full">
      <canvas
        ref={canvasRef}
        className="w-full bg-white border-2 border-slate-200 rounded-xl touch-none cursor-crosshair"
        style={{ height: `${height}px` }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />

      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={clear}
          className="flex-1 h-10 bg-slate-100 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all"
        >
          Neu unterschreiben
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!hasContent}
          className="flex-[2] h-10 bg-black text-white rounded-xl text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 disabled:active:scale-100"
        >
          Unterschrift bestätigen
        </button>
      </div>
    </div>
  );
};

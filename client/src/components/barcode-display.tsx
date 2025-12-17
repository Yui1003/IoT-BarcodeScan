import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeDisplayProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
}

export interface BarcodeDisplayHandle {
  downloadPNG: (filename?: string) => void;
}

const BarcodeDisplay = forwardRef<BarcodeDisplayHandle, BarcodeDisplayProps>(({ 
  value, 
  format = "CODE128", 
  width = 2, 
  height = 100, 
  displayValue = true 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format: format as any,
          width,
          height,
          displayValue,
          font: 'monospace',
          fontSize: 16,
          textMargin: 8,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (error) {
        console.error("Failed to generate barcode:", error);
      }
    }
  }, [value, format, width, height, displayValue]);

  useImperativeHandle(ref, () => ({
    downloadPNG: (filename = 'barcode') => {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }));

  return (
    <div className="inline-block bg-white p-2 rounded">
      <canvas ref={canvasRef} />
    </div>
  );
});

BarcodeDisplay.displayName = 'BarcodeDisplay';

export default BarcodeDisplay;

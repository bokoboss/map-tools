import html2canvas from 'html2canvas';

export async function exportMapToPng(mapElement: HTMLElement, filename = 'map-capture.png'): Promise<void> {
  const canvas = await html2canvas(mapElement, { useCORS: true, logging: false });
  const anchor = document.createElement('a');
  anchor.href = canvas.toDataURL('image/png');
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

// contentScript.js

let drawing = false;
let startX, startY;
let box = null;

function onMouseDown(e) {
  if (drawing) return; // Prevent drawing multiple boxes simultaneously
  drawing = true;
  startX = e.clientX + window.scrollX;
  startY = e.clientY + window.scrollY;

  box = document.createElement('div');
  box.style.position = 'absolute';
  box.style.border = '2px dashed red';
  box.style.left = `${startX}px`;
  box.style.top = `${startY}px`;
  document.body.appendChild(box);
}

function onMouseMove(e) {
  if (!drawing) return;
  const currentX = e.clientX + window.scrollX;
  const currentY = e.clientY + window.scrollY;

  const width = currentX - startX;
  const height = currentY - startY;

  box.style.width = `${Math.abs(width)}px`;
  box.style.height = `${Math.abs(height)}px`;

  box.style.left = `${width < 0 ? currentX : startX}px`;
  box.style.top = `${height < 0 ? currentY : startY}px`;
}

function onMouseUp(e) {
  if (!drawing) return;
  drawing = false;

  // Capture the screenshot and copy to clipboard
  captureAndCopy();
}

function captureAndCopy() {
  const boxRect = box.getBoundingClientRect();

  html2canvas(document.body, {
    x: boxRect.left + window.scrollX,
    y: boxRect.top + window.scrollY,
    width: boxRect.width,
    height: boxRect.height
  }).then(canvas => {
    // Convert captured image to grayscale
    grayscaleImage(canvas);

    canvas.toBlob(blob => {
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item]).then(() => {
        console.log('Screenshot (grayscale) copied to clipboard!');
        // Clean up
        document.body.removeChild(box);
        // Send message to background script
        chrome.runtime.sendMessage({ action: 'screenshot-captured' });
      }).catch(err => {
        console.error('Error copying to clipboard:', err);
      });
    }, 'image/png');
  });
}

function grayscaleImage(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = avg;     // Red
    data[i + 1] = avg; // Green
    data[i + 2] = avg; // Blue
  }

  ctx.putImageData(imageData, 0, 0);
}

function enableDrawing() {
  document.body.style.cursor = 'crosshair';
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

enableDrawing();

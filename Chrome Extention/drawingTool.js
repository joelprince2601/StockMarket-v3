// drawingTool.js

let drawing = false;
let startX, startY;
let box = null;
const apiKey = 'e20e3ffc76578182dbda0c8ee47d11ad';
const alphaVantageApiKey = '6H8T62K80FUAWG96';
const googleCloudApiKey = 'YOUR_GOOGLE_CLOUD_API_KEY'; // Replace with your actual API key

function onMouseDown(e) {
    if (drawing) return;
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
        canvas.toBlob(blob => {
            const item = new ClipboardItem({ 'image/png': blob });
            navigator.clipboard.write([item]).then(() => {
                console.log('Screenshot copied to clipboard!');
                document.body.removeChild(box);
                compareWithCharts(canvas);
                retraceLines(canvas);
            }).catch(err => {
                console.error('Error copying to clipboard:', err);
            });
        }, 'image/png');
    });
}

async function compareWithCharts(capturedCanvas) {
    const capturedImageData = capturedCanvas.toDataURL().split(',')[1];

    // Load and compare with charts
    const chartsFolder = chrome.runtime.getURL('charts');
    const charts = ['chart1.png', 'chart2.png', 'chart3.png']; // Replace with actual chart names

    let bestMatch = null;
    let maxSimilarity = -1;

    for (const chart of charts) {
        const chartImage = await loadImage(`${chartsFolder}/${chart}`);
        const similarity = await compareImagesWithVisionAPI(capturedImageData, chartImage);

        console.log(`Similarity with ${chart}: ${similarity}`);

        if (similarity > maxSimilarity) {
            maxSimilarity = similarity;
            bestMatch = chart;
        }
    }

    // Show popup with best match information
    if (bestMatch && maxSimilarity >= 0) {
        showPopup(`Best match: ${bestMatch}, Similarity: ${(maxSimilarity * 100).toFixed(2)}%`);
    } else {
        showPopup('No match found with any chart');
    }
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL().split(',')[1]);
        };
        img.onerror = reject;
        img.src = src;
    });
}

async function compareImagesWithVisionAPI(image1Data, image2Data) {
    const apiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${googleCloudApiKey}`;

    const requestBody = {
        requests: [
            {
                image: { content: image1Data },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
            },
            {
                image: { content: image2Data },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
            }
        ]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        // Compare the text detected in both images
        const text1 = data.responses[0].fullTextAnnotation?.text || '';
        const text2 = data.responses[1].fullTextAnnotation?.text || '';

        // Calculate similarity using Levenshtein distance
        const similarity = 1 - (levenshteinDistance(text1, text2) / Math.max(text1.length, text2.length));

        return similarity;
    } catch (error) {
        console.error('Error comparing images:', error);
        return 0;
    }
}

function levenshteinDistance(s1, s2) {
    const m = s1.length;
    const n = s2.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]) + 1;
            }
        }
    }

    return dp[m][n];
}

function showPopup(message) {
    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.bottom = '10px';
    popup.style.left = '10px';
    popup.style.padding = '10px';
    popup.style.backgroundColor = 'white';
    popup.style.color = 'black';
    popup.style.border = '1px solid black';
    popup.style.zIndex = '10000';
    popup.innerText = message;
    document.body.appendChild(popup);

    setTimeout(() => {
        document.body.removeChild(popup);
    }, 5000);
}

function retraceLines(canvas) {
    const retraceCanvas = document.createElement('canvas');
    retraceCanvas.width = canvas.width;
    retraceCanvas.height = canvas.height;
    const retraceCtx = retraceCanvas.getContext('2d');

    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Edge detection using simple threshold
    const threshold = 128;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (avg < threshold) {
            data[i] = data[i + 1] = data[i + 2] = 0; // Black
        } else {
            data[i] = data[i + 1] = data[i + 2] = 255; // White
        }
    }

    retraceCtx.putImageData(imageData, 0, 0);

    // Show retraced lines in a popup
    const popup = document.createElement('div');
    popup.style.position = 'fixed';
    popup.style.bottom = '10px';
    popup.style.right = '10px';
    popup.style.padding = '10px';
    popup.style.backgroundColor = 'white';
    popup.style.border = '1px solid black';
    popup.style.zIndex = '10000';

    const img = new Image();
    img.src = retraceCanvas.toDataURL();
    popup.appendChild(img);

    document.body.appendChild(popup);

    setTimeout(() => {
        document.body.removeChild(popup);
    }, 5000);
}

function enableDrawing() {
    document.body.style.cursor = 'crosshair';
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function fetchHeadlines() {
  chrome.runtime.sendMessage({ action: 'fetchHeadlines' }, response => {
      if (response && response.headlines) {
          displayHeadlinesAndRecommendations(response.headlines);
      } else {
          console.error('Failed to fetch headlines');
      }
  });
}

async function displayHeadlinesAndRecommendations(headlines) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '10px';
  container.style.left = '10px';
  container.style.padding = '10px';
  container.style.backgroundColor = 'white';
  container.style.border = '1px solid black';
  container.style.zIndex = '10000';
  container.style.display = 'flex';
  container.style.maxWidth = '600px';
  container.style.maxHeight = '80vh';

  const headlinesDiv = document.createElement('div');
  headlinesDiv.style.flex = '1';
  headlinesDiv.style.marginRight = '10px';
  headlinesDiv.style.overflowY = 'auto';

  const recommendationsDiv = document.createElement('div');
  recommendationsDiv.style.flex = '1';
  recommendationsDiv.style.overflowY = 'auto';

  container.appendChild(headlinesDiv);
  container.appendChild(recommendationsDiv);

  const headlinesTitle = document.createElement('h3');
  headlinesTitle.innerText = 'Top 5 Stock Market Headlines';
  headlinesDiv.appendChild(headlinesTitle);

  headlines.forEach(headline => {
      const headlineElement = document.createElement('p');
      headlineElement.innerText = headline;
      headlinesDiv.appendChild(headlineElement);
  });

  const recommendationsTitle = document.createElement('h3');
  recommendationsTitle.innerText = 'Stock Recommendations';
  recommendationsDiv.appendChild(recommendationsTitle);

  document.body.appendChild(container);

  // Fetch and display recommendations
  const recommendations = await getStockRecommendations(headlines);
  recommendations.forEach(rec => {
      const recElement = document.createElement('p');
      recElement.innerHTML = `<strong>${rec.symbol}:</strong> ${rec.recommendation}`;
      recommendationsDiv.appendChild(recElement);
  });
}

async function getStockRecommendations(headlines) {
  const stockSymbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'HINDUNILVR', 'KOTAKBANK',
    'SBIN', 'BHARTIARTL', 'HCLTECH', 'ITC', 'BAJFINANCE', 'ASIANPAINT', 'LT', 'AXISBANK',
    'ULTRACEMCO', 'WIPRO', 'MARUTI', 'DMART', 'ADANIGREEN', 'TITAN', 'SUNPHARMA', 'BAJAJFINSV',
    'NTPC', 'NESTLEIND', 'ONGC', 'TATASTEEL', 'JSWSTEEL', 'POWERGRID', 'TECHM', 'INDUSINDBK',
    'COALINDIA', 'DIVISLAB', 'ADANIPORTS', 'M&M', 'HDFCLIFE', 'SBILIFE', 'DRREDDY', 'BPCL',
    'GRASIM', 'CIPLA', 'IOC', 'HEROMOTOCO', 'TATAMOTORS', 'BRITANNIA', 'PIDILITIND', 'APOLLOHOSP',
    'HINDALCO', 'SHREECEM', 'BAJAJ-AUTO', 'VEDL'
  ];
  const recommendations = [];

  for (const symbol of stockSymbols) {
      try {
          const sentiment = await fetchStockSentiment(symbol);
          const recommendation = analyzeStockSentiment(sentiment, headlines);
          recommendations.push({ symbol, recommendation });
      } catch (error) {
          console.error(`Error fetching sentiment for ${symbol}:`, error);
      }
  }

  return recommendations;
}

async function fetchStockSentiment(symbol) {
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${alphaVantageApiKey}`;
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

function analyzeStockSentiment(sentimentData, headlines) {
  if (!sentimentData || !sentimentData.feed) {
      return "Unable to analyze due to insufficient data";
  }

  let sentimentScore = 0;
  let relevantArticles = 0;

  sentimentData.feed.forEach(article => {
      if (article.overall_sentiment_score) {
          sentimentScore += parseFloat(article.overall_sentiment_score);
          relevantArticles++;
      }
  });

  const averageSentiment = relevantArticles > 0 ? sentimentScore / relevantArticles : 0;

  // Check if any headlines mention the company negatively
  const companyName = sentimentData.feed[0]?.ticker_sentiment[0]?.ticker;
  const negativeHeadline = headlines.some(headline => 
      headline.toLowerCase().includes(companyName.toLowerCase()) && 
      (headline.toLowerCase().includes('fall') || headline.toLowerCase().includes('drop') || headline.toLowerCase().includes('decline'))
  );

  if (averageSentiment > 0.2 && !negativeHeadline) {
      return "Strong Buy";
  } else if (averageSentiment > 0 && !negativeHeadline) {
      return "Buy";
  } else if (averageSentiment < -0.2 || negativeHeadline) {
      return "Sell";
  } else {
      return "Hold";
  }
}

// Initialize the tool
enableDrawing();
fetchHeadlines();
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const path = require('path');

const width = 800; // Genişlik
const height = 400; // Yükseklik

// Grafik Servisi Oluştur
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#1a1a1a' });

async function createCryptoChart(symbol, history, currentPrice) {
    // Son 50 veriyi al (çok sıkışık olmasın)
    const dataPoints = history.slice(-50);

    // Etiketler (Basitçe 1, 2, 3... veya boşluk)
    const labels = dataPoints.map((_, i) => i + 1);

    // Renk Belirle (Son fiyat > İlk fiyat ise Yeşil, yoksa Kırmızı)
    const startPrice = dataPoints[0];
    const isBullish = currentPrice >= startPrice;

    const lineColor = isBullish ? '#00ffa3' : '#ff4d4d'; // Neon Yeşil veya Neon Kırmızı
    const fillColor = isBullish ? 'rgba(0, 255, 163, 0.2)' : 'rgba(255, 77, 77, 0.2)';

    const configuration = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol} Fiyat Geçmişi`,
                data: dataPoints,
                borderColor: lineColor,
                backgroundColor: fillColor,
                borderWidth: 3,
                pointRadius: 0, // Noktaları gizle, düz çizgi olsun
                fill: true,
                tension: 0.4 // Yumuşak kıvrımlar (Bezier)
            }]
        },
        options: {
            plugins: {
                legend: {
                    labels: { color: 'white', font: { size: 18, family: 'Arial' } }
                },
                title: {
                    display: true,
                    text: `${symbol} / USD - Anlık: $${currentPrice.toFixed(2)}`,
                    color: 'white',
                    font: { size: 24, weight: 'bold', family: 'Arial' }
                }
            },
            scales: {
                x: {
                    display: false // X eksenini gizle (temiz görünüm)
                },
                y: {
                    ticks: {
                        color: '#cccccc',
                        font: { size: 14 },
                        callback: function (value) { return '$' + value.toFixed(1); }
                    },
                    grid: {
                        color: '#333333'
                    }
                }
            }
        }
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration);
}

module.exports = { createCryptoChart };

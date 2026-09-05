let currentTheme = 'light';
     let currentQRType = 'text';
     let currentQRCode = null;
     let advancedExpanded = false;
     function toggleTheme() {
         currentTheme = currentTheme === 'light' ? 'dark' : 'light';
         document.body.setAttribute('data-theme', currentTheme);
         
         const icon = document.querySelector('.theme-toggle i');
         icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
         
         localStorage.setItem('tools-theme', currentTheme);
         localStorage.setItem('qrcode-theme', currentTheme);
         
         if (currentQRCode) {
             generateQR();
         }
     }
     function loadTheme() {
         const savedTheme = localStorage.getItem('tools-theme') || localStorage.getItem('qrcode-theme') || 'light';
         currentTheme = savedTheme;
         document.body.setAttribute('data-theme', currentTheme);
         
         const icon = document.querySelector('.theme-toggle i');
         icon.className = currentTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
     }
     function setQRType(type) {
         currentQRType = type;
         
         document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
         event.target.closest('.type-btn').classList.add('active');
         
         document.querySelectorAll('.input-form').forEach(form => form.style.display = 'none');
         document.getElementById(type + '-form').style.display = 'block';
         
         clearQRCode();
     }
     function toggleAdvanced() {
         advancedExpanded = !advancedExpanded;
         const content = document.getElementById('advanced-content');
         const icon = document.querySelector('.collapsible i');
         
         if (advancedExpanded) {
             content.classList.remove('hidden');
             icon.classList.remove('collapsed');
         } else {
             content.classList.add('hidden');
             icon.classList.add('collapsed');
         }
     }
     function getQRData() {
         switch (currentQRType) {
             case 'text':
                 return document.getElementById('textInput').value;
             
             case 'url':
                 const url = document.getElementById('urlInput').value;
                 return url.startsWith('http') ? url : 'https://' + url;
             
             case 'wifi':
                 const ssid = document.getElementById('wifiSSID').value;
                 const password = document.getElementById('wifiPassword').value;
                 const security = document.getElementById('wifiSecurity').value;
                 return `WIFI:T:${security};S:${ssid};P:${password};H:false;;`;
             
             case 'email':
                 const email = document.getElementById('emailAddress').value;
                 const subject = document.getElementById('emailSubject').value;
                 const message = document.getElementById('emailMessage').value;
                 let emailData = `mailto:${email}`;
                 const params = [];
                 if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
                 if (message) params.push(`body=${encodeURIComponent(message)}`);
                 if (params.length > 0) emailData += '?' + params.join('&');
                 return emailData;
             
             case 'phone':
                 return `tel:${document.getElementById('phoneNumber').value}`;
             
             case 'sms':
                 const smsNumber = document.getElementById('smsNumber').value;
                 const smsMessage = document.getElementById('smsMessage').value;
                 return `sms:${smsNumber}${smsMessage ? '?body=' + encodeURIComponent(smsMessage) : ''}`;
             
             default:
                 return '';
         }
     }
     async function generateQR() {
         const data = getQRData();
         
         if (!data.trim()) {
             showFeedback('Please enter some data to generate QR code', 'error');
             return;
         }
         try {
             const size = parseInt(document.getElementById('qrSize').value);
             const errorCorrectionLevel = document.getElementById('errorCorrection').value;
             const foregroundColor = document.getElementById('foregroundColor').value.replace('#', '');
             const backgroundColor = document.getElementById('backgroundColor').value.replace('#', '');
             const qrContainer = document.getElementById('qrcode');
             qrContainer.innerHTML = '';
             const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&color=${foregroundColor}&bgcolor=${backgroundColor}&ecc=${errorCorrectionLevel}`;
             
             const img = document.createElement('img');
             img.src = qrUrl;
             img.alt = 'Generated QR Code';
             img.style.maxWidth = '100%';
             img.style.height = 'auto';
             img.style.border = '1px solid var(--border-color)';
             img.style.borderRadius = '8px';
             
             img.onload = function() {
                 qrContainer.appendChild(img);
                 
                 document.getElementById('qr-placeholder').style.display = 'none';
                 document.getElementById('qr-result').style.display = 'block';
                 
                 document.getElementById('qr-size-stat').textContent = size;
                 document.getElementById('qr-data-length').textContent = data.length;
                 document.getElementById('qr-data-preview').textContent = 
                     data.length > 100 ? data.substring(0, 100) + '...' : data;
                 
                 currentQRCode = data;
                 showFeedback('QR code generated successfully!');
             };
             
             img.onerror = function() {
                 showFeedback('Failed to generate QR code. Please try again.', 'error');
             };
             
         } catch (error) {
             console.error('QR generation error:', error);
             showFeedback('Error generating QR code: ' + error.message, 'error');
         }
     }
     async function downloadQR(format) {
         if (!currentQRCode) {
             showFeedback('Generate a QR code first', 'error');
             return;
         }
         try {
             const size = parseInt(document.getElementById('qrSize').value);
             const errorCorrectionLevel = document.getElementById('errorCorrection').value;
             const foregroundColor = document.getElementById('foregroundColor').value.replace('#', '');
             const backgroundColor = document.getElementById('backgroundColor').value.replace('#', '');
             const data = getQRData();
             let downloadUrl;
             const filename = `qrcode-${Date.now()}.${format}`;
             if (format === 'svg') {
                 downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?format=svg&size=${size}x${size}&data=${encodeURIComponent(data)}&color=${foregroundColor}&bgcolor=${backgroundColor}&ecc=${errorCorrectionLevel}`;
             } else {
                 const imageFormat = format === 'jpg' ? 'jpg' : 'png';
                 downloadUrl = `https://api.qrserver.com/v1/create-qr-code/?format=${imageFormat}&size=${size}x${size}&data=${encodeURIComponent(data)}&color=${foregroundColor}&bgcolor=${backgroundColor}&ecc=${errorCorrectionLevel}`;
             }
             showFeedback('Preparing download...', 'info');
             
             const response = await fetch(downloadUrl);
             if (!response.ok) {
                 throw new Error('Failed to fetch QR code image');
             }
             
             const blob = await response.blob();
             
             const blobUrl = URL.createObjectURL(blob);
             
             const link = document.createElement('a');
             link.download = filename;
             link.href = blobUrl;
             link.style.display = 'none';
             
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             
             setTimeout(() => {
                 URL.revokeObjectURL(blobUrl);
             }, 1000);
             showFeedback(`QR code downloaded as ${format.toUpperCase()}!`);
         } catch (error) {
             console.error('Download error:', error);
             showFeedback('Download failed. You can right-click the QR code and "Save image as..." instead.', 'error');
         }
     }
     async function copyQRData() {
         if (!currentQRCode) {
             showFeedback('Generate a QR code first', 'error');
             return;
         }
         try {
             await navigator.clipboard.writeText(currentQRCode);
             showFeedback('QR code data copied to clipboard!');
         } catch (error) {
             console.error('Copy data error:', error);
             showFeedback('Could not copy to clipboard', 'error');
         }
     }
     function clearQRCode() {
         document.getElementById('qr-placeholder').style.display = 'block';
         document.getElementById('qr-result').style.display = 'none';
         document.getElementById('qrcode').innerHTML = '';
         currentQRCode = null;
     }
     function clearAll() {
         if (confirm('Clear all data and reset form?')) {
             document.querySelectorAll('input, textarea, select').forEach(input => {
                 if (input.type === 'color') {
                     if (input.id === 'foregroundColor') input.value = '#000000';
                     else if (input.id === 'backgroundColor') input.value = '#ffffff';
                 } else if (input.tagName === 'SELECT') {
                     input.selectedIndex = input.querySelector('[selected]') ? 
                         Array.from(input.options).findIndex(opt => opt.hasAttribute('selected')) : 0;
                 } else {
                     input.value = '';
                 }
             });
             
             setQRType('text');
             document.querySelector('.type-btn').click();
             
             clearQRCode();
             
             showFeedback('All data cleared!');
         }
     }
     function showFeedback(message, type = 'success') {
         const feedback = document.createElement('div');
         feedback.className = 'success-feedback';
         feedback.textContent = message;
         
         if (type === 'error') {
             feedback.style.backgroundColor = 'var(--error-color)';
         } else if (type === 'info') {
             feedback.style.backgroundColor = 'var(--info-color)';
         }
         
         document.body.appendChild(feedback);
         
         setTimeout(() => {
             feedback.remove();
         }, 3000);
     }
     function setupAutoGenerate() {
         const inputs = document.querySelectorAll('input, textarea, select');
         inputs.forEach(input => {
             input.addEventListener('input', () => {
                 if (currentQRCode && typeof QRCode !== 'undefined') {
                     setTimeout(generateQR, 300); // Debounce
                 }
             });
         });
     }
     function loadExamples() {
         const examples = {
             text: "Hello, World! This is a sample QR code.",
             url: "https://github.com/pruthvishetty",
             wifi: { ssid: "MyHomeWiFi", password: "password123", security: "WPA" },
             email: { email: "hello@pruthvishetty.com", subject: "Hello from QR Code!" },
             phone: "+1234567890",
             sms: { number: "+1234567890", message: "Hello from QR Code!" }
         };
         console.log('Examples loaded:', examples);
     }
     async function generateQREnhanced() {
         generateQR();
     }
     document.addEventListener('DOMContentLoaded', function() {
         loadTheme();
         setupAutoGenerate();
         loadExamples();
         
         const placeholder = document.getElementById('qr-placeholder');
         if (placeholder) {
             placeholder.innerHTML = `
                 <i class="fas fa-qrcode"></i>
                 <p>QR code will appear here</p>
                 <p style="font-size: 0.8rem; color: var(--success-color);">✅ Ready to generate QR codes</p>
             `;
         }
         
         document.addEventListener('keydown', function(e) {
             if (e.ctrlKey || e.metaKey) {
                 switch(e.key) {
                     case 'Enter':
                         e.preventDefault();
                         generateQREnhanced();
                         break;
                     case 'k':
                         e.preventDefault();
                         clearAll();
                         break;
                 }
             }
         });
     });
// Trading Journal App - Main Application Logic

const API = 'http://localhost:5000/api';
let currentFolder = null;
let currentImage = null;
let allTrades = [];
let charts = {};

// ============= Initialization =============

document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    document.getElementById('create-date').valueAsDate = new Date();
    loadFolders();
    loadTrades();
    loadStats();
    initCharts();
    setTimeout(() => {
        populateByStrategy();
        populateByAssetType();
        populateByDayOfWeek();
        initTradeTimeChart();
    }, 500);
    setupEventListeners();
}

// ============= Event Listeners =============

function setupEventListeners() {
    // Create form listeners
    document.getElementById('create-date')?.addEventListener('change', updateSavePath);
    document.getElementById('create-ticker')?.addEventListener('input', updateSavePath);
    document.getElementById('create-timeframe')?.addEventListener('change', updateSavePath);
    document.getElementById('flag-i')?.addEventListener('change', updateSavePath);
    document.getElementById('flag-l')?.addEventListener('change', updateSavePath);
    document.getElementById('flag-o')?.addEventListener('change', updateSavePath);
    document.querySelectorAll('input[name="close-flag"]').forEach(radio => {
        radio.addEventListener('change', updateSavePath);
    });

    // Image upload handlers
    const imagePreview = document.getElementById('image-preview');
    const imageInput = document.getElementById('image-input');

    // File input change
    imageInput?.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleImageFile(e.target.files[0]);
        }
    });

    // Click to upload
    imagePreview?.addEventListener('click', () => {
        imageInput?.click();
    });

    // Drag and drop
    imagePreview?.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        imagePreview.classList.add('drag-over');
    });

    imagePreview?.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        imagePreview.classList.remove('drag-over');
    });

    imagePreview?.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        imagePreview.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files[0] && files[0].type.startsWith('image/')) {
            handleImageFile(files[0]);
        } else {
            alert('Please drop an image file');
        }
    });

    // Paste image from clipboard
    document.addEventListener('paste', (e) => {
        // Only handle paste if Create section is active and focus is not on a textarea
        const isCreateActive = document.getElementById('create').classList.contains('active');
        const focusedElement = document.activeElement;
        const isTextarea = focusedElement.tagName === 'TEXTAREA' || focusedElement.tagName === 'INPUT';
        
        if (!isCreateActive || isTextarea) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                if (blob) {
                    handleImageFile(blob);
                }
                break;
            }
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('fullscreen-modal');
        const isFullscreen = modal && modal.classList.contains('active');
        
        if (e.key === 'Escape' && isFullscreen) {
            exitFullscreen();
        }
        
        if (isFullscreen) {
            if (e.key === 'ArrowLeft') {
                previousImage();
                e.preventDefault();
            } else if (e.key === 'ArrowRight') {
                nextImage();
                e.preventDefault();
            }
        }
        
        // Ctrl+Enter to save notes
        if (e.key === 'Enter' && e.ctrlKey) {
            if (document.getElementById('review').classList.contains('active')) {
                saveCurrentNotes();
            } else if (document.getElementById('create').classList.contains('active')) {
                uploadImage();
            } else if (isFullscreen) {
                saveFullscreenNotes();
            }
        }
    });
}

// Handle image file upload
function handleImageFile(file) {
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const imageData = e.target.result;
        const imagePreview = document.getElementById('image-preview');
        const imageInput = document.getElementById('image-input');
        
        // Display image
        imagePreview.innerHTML = `<img src="${imageData}" alt="Chart preview">`;
        imagePreview.classList.add('has-image');
        
        // Show clear buttons
        const clearBtn = document.getElementById('clear-image-btn');
        if (clearBtn) clearBtn.style.display = 'block';
        
        const clearIconBtn = document.getElementById('clear-icon-btn');
        if (clearIconBtn) clearIconBtn.style.display = 'block';
        
        // Store file directly in input using DataTransfer API
        try {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            imageInput.files = dataTransfer.files;
            
            showSuccess('create', `✓ Image ready: ${file.name}`);
            updateSavePath();
        } catch (error) {
            console.error('Error storing file:', error);
            showError('create', 'Error storing image file');
        }
    };
    
    reader.onerror = () => {
        showError('create', 'Error reading image file');
    };
    
    reader.readAsDataURL(file);
}

// Clear/Remove image
function clearImage() {
    const imagePreview = document.getElementById('image-preview');
    const imageInput = document.getElementById('image-input');
    
    // Reset preview
    imagePreview.innerHTML = `
        <div class="image-preview-content">
            <div class="image-upload-icon">📸</div>
            <div class="image-upload-text">
                <p><strong>Drag & drop</strong> or paste image</p>
                <p style="font-size: 12px; color: var(--color-text-tertiary);">Paste with Ctrl+V</p>
            </div>
        </div>
    `;
    imagePreview.classList.remove('has-image');
    
    // Reset file input
    imageInput.value = '';
    
    // Hide clear button (bottom one)
    const clearBtn = document.getElementById('clear-image-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    
    // Hide clear icon button (top right)
    const clearIconBtn = document.getElementById('clear-icon-btn');
    if (clearIconBtn) clearIconBtn.style.display = 'none';
    
    showSuccess('create', '✓ Image cleared');
    updateSavePath();
}

// ============= Section Navigation =============

function switchSection(section) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section).classList.add('active');
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    event.target.classList.add('active');

    // Update header
    const titles = {
        review: 'Journal Review',
        create: 'Journal Create',
        analyze: 'Trading Analysis'
    };
    document.getElementById('current-section').textContent = titles[section];

    // Trigger chart resize if needed
    if (section === 'analyze') {
        setTimeout(() => {
            if (charts.equity) charts.equity.resize();
            if (charts.daily) charts.daily.resize();
        }, 100);
    }
}

function switchAnalyzeTab(tab) {
    // Hide all tabs
    document.querySelectorAll('.analyze-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tab + '-tab').classList.add('active');
    
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    // Trigger chart redraw or calendar generation
    if (charts.equity && tab === 'dashboard') {
        setTimeout(() => charts.equity.resize(), 100);
    } else if (charts.daily && tab === 'pnl') {
        setTimeout(() => charts.daily.resize(), 100);
    } else if (tab === 'radar') {
        console.log('🎯 Radar tab clicked');
        setTimeout(() => {
            initRadarChart();
            if (charts.radar) charts.radar.resize();
        }, 100);
    } else if (tab === 'calendar') {
        console.log('📅 Calendar tab clicked');
        console.log('🔍 Trades available now:', window.allTrades?.length || 0);
        
        // Generate calendar immediately - trades should already be loaded
        generateCalendar();
    } else if (tab === 'tables') {
        console.log('📋 Tables tab clicked');
    }
}

function waitForTrades(maxWait = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const checkTrades = () => {
            const elapsed = Date.now() - startTime;
            
            if (window.allTrades && window.allTrades.length > 0) {
                console.log(`✓ Trades loaded after ${elapsed}ms`);
                resolve();
            } else if (elapsed > maxWait) {
                console.warn(`⚠️ Timeout waiting for trades after ${maxWait}ms`);
                resolve(); // Resolve anyway to show empty calendar
            } else {
                console.log(`⏳ Waiting for trades... (${elapsed}ms)`);
                setTimeout(checkTrades, 100);
            }
        };
        
        checkTrades();
    });
}

// ============= Calendar Functions =============

let currentCalendarDate = new Date();

function generateCalendar() {
    console.log('📅 Generating calendar...');
    console.log('🔍 Trades available:', window.allTrades?.length || 0);
    
    if (window.allTrades && window.allTrades.length > 0) {
        console.log('📋 First 3 trades:');
        window.allTrades.slice(0, 3).forEach((t, i) => {
            console.log(`  ${i+1}. Date:"${t.EntryDate}" P&L:${t.RealizedPL} Type:${typeof t.EntryDate}`);
        });
    }
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Update month header
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
    document.getElementById('calendar-month').textContent = `${monthNames[month]} ${year}`;
    
    // Calculate daily P&L from trades
    const dailyPnL = calculateDailyPnL(year, month);
    console.log('📊 Days with trades:', Object.keys(dailyPnL).length);
    console.log('📈 Daily P&L data:', dailyPnL);
    
    // Generate calendar grid
    let calendarHTML = '';
    
    // Previous month's days (grayed out)
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        calendarHTML += `<div class="calendar-day no-trades" style="opacity: 0.3;">
            <div class="calendar-day-date">${day}</div>
        </div>`;
    }
    
    // Current month's days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = dailyPnL[dateStr] || { pnl: 0, trades: 0 };
        
        const hasTrades = dayData.trades > 0;
        const isWinning = dayData.pnl > 0;
        const isLosingDay = dayData.pnl < 0;
        
        let className = 'calendar-day';
        if (!hasTrades) {
            className += ' no-trades';
        } else if (isWinning) {
            className += ' winning';
        } else if (isLosingDay) {
            className += ' losing';
        }
        
        const pnlText = hasTrades ? 
            (isWinning ? '+' : '') + '$' + Math.abs(dayData.pnl).toFixed(0) : 
            '-';
        
        calendarHTML += `<div class="${className}">
            <div class="calendar-day-date">${day}</div>
            <div class="calendar-day-pnl">${pnlText}</div>
            <div class="calendar-day-count">${dayData.trades} trade${dayData.trades !== 1 ? 's' : ''}</div>
        </div>`;
    }
    
    // Next month's days (grayed out)
    const remainingDays = 42 - (firstDay + daysInMonth); // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
        calendarHTML += `<div class="calendar-day no-trades" style="opacity: 0.3;">
            <div class="calendar-day-date">${day}</div>
        </div>`;
    }
    
    document.getElementById('calendar-grid').innerHTML = calendarHTML;
    
    // Update summary
    updateCalendarSummary(year, month, dailyPnL);
    
    console.log('✓ Calendar generated');
}

function calculateDailyPnL(year, month) {
    const dailyPnL = {};
    
    console.log(`🔢 Calculating for: ${year}-${month+1}`);
    
    if (!window.allTrades || window.allTrades.length === 0) {
        console.warn('⚠️ No trades available');
        return dailyPnL;
    }
    
    // Group trades by entry date and sum P&L
    window.allTrades.forEach((trade, index) => {
        const dateStr = trade.EntryDate?.trim(); // Trim whitespace
        
        if (!dateStr) {
            console.warn(`⚠️ Trade ${index} missing EntryDate`);
            return;
        }
        
        // Extract year-month from date string
        const [tradeYear, tradeMonth, tradeDay] = dateStr.split('-');
        
        if (tradeYear == year && tradeMonth == String(month + 1).padStart(2, '0')) {
            if (!dailyPnL[dateStr]) {
                dailyPnL[dateStr] = { pnl: 0, trades: 0 };
            }
            
            dailyPnL[dateStr].pnl += trade.RealizedPL || 0;
            dailyPnL[dateStr].trades += 1;
            
            if (index < 5) {
                console.log(`  ✓ Trade ${index+1}: ${dateStr} = $${trade.RealizedPL}`);
            }
        }
    });
    
    return dailyPnL;
}

function updateCalendarSummary(year, month, dailyPnL) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    
    let totalPnL = 0;
    let totalTrades = 0;
    let winningDays = 0;
    let losingDays = 0;
    
    Object.values(dailyPnL).forEach(day => {
        totalPnL += day.pnl;
        totalTrades += day.trades;
        if (day.pnl > 0) winningDays++;
        if (day.pnl < 0) losingDays++;
    });
    
    document.getElementById('calendar-total').textContent = 
        (totalPnL > 0 ? '+' : '') + '$' + totalPnL.toFixed(0);
    document.getElementById('calendar-trades').textContent = totalTrades;
    document.getElementById('calendar-wins').textContent = winningDays;
    document.getElementById('calendar-losses').textContent = losingDays;
}

function previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    generateCalendar();
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    generateCalendar();
}

// ============= Review Section Features =============

// Filter trades by outcome (winner/loser)
async function filterByOutcome(outcome) {
    document.querySelectorAll('.outcome-pill').forEach(p => p.classList.remove('active'));
    event.target.classList.add('active');

    const tickerSelect = document.getElementById('review-ticker');
    tickerSelect.innerHTML = '<option value="">Select a trade...</option>';

    if (outcome === 'all' || !allFolders) {
        // Show all folders
        allFolders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.path;
            option.textContent = folder.name;
            tickerSelect.appendChild(option);
        });
    } else {
        // Filter by outcome - fetch trade data for each folder
        for (const folder of allFolders) {
            try {
                const response = await fetch(`${API}/trade/${folder.path}`);
                if (response.ok) {
                    const trade = await response.json();
                    const isWinner = trade.TradeOutcome === 'Winner';
                    
                    // Only show if outcome matches filter
                    if ((outcome === 'winner' && isWinner) || (outcome === 'loser' && !isWinner)) {
                        const option = document.createElement('option');
                        option.value = folder.path;
                        option.textContent = folder.name;
                        tickerSelect.appendChild(option);
                    }
                }
            } catch (error) {
                console.error('Error fetching trade for', folder.path, error);
            }
        }
    }
}

function applyFilters() {
    loadFolders();
}

function previousImage() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        const imageAtIndex = currentFolderData.images[currentImageIndex];
        if (imageAtIndex) {
            currentImage = imageAtIndex;
            displayImageAtIndex(currentFolderData);
            
            // Update fullscreen if open
            if (document.getElementById('fullscreen-modal').classList.contains('active')) {
                updateFullscreenDisplay();
            }
        }
    }
}

function nextImage() {
    if (currentImageIndex < currentFolderData.images.length - 1) {
        currentImageIndex++;
        const imageAtIndex = currentFolderData.images[currentImageIndex];
        if (imageAtIndex) {
            currentImage = imageAtIndex;
            displayImageAtIndex(currentFolderData);
            
            // Update fullscreen if open
            if (document.getElementById('fullscreen-modal').classList.contains('active')) {
                updateFullscreenDisplay();
            }
        }
    }
}

function fullscreenImage() {
    if (!currentImage || !currentFolderData) return;
    
    // Show modal
    const modal = document.getElementById('fullscreen-modal');
    modal.classList.add('active');
    
    // Populate fullscreen view
    updateFullscreenDisplay();
    
    // Disable body scroll
    document.body.style.overflow = 'hidden';
}

function exitFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

function updateFullscreenDisplay() {
    if (!currentImage || !currentFolderData) return;
    
    const imageUrl = `${API}/folder/${currentFolder}/image/${currentImage}`;
    
    // Update image
    document.getElementById('fullscreen-image').src = imageUrl;
    
    // Update image name
    document.getElementById('fullscreen-image-name').textContent = currentImage;
    
    // Update counter
    document.getElementById('fullscreen-counter').textContent = 
        `Image ${currentImageIndex + 1} of ${currentFolderData.images.length}`;
    
    // Load notes
    fetch(`${API}/folder/${currentFolder}/notes`)
        .then(r => r.json())
        .then(notes => {
            document.getElementById('fullscreen-notes').value = notes[currentImage] || '';
        })
        .catch(e => console.error('Error loading notes:', e));
    
    // Load trade info
    fetch(`${API}/trade/${currentFolder}`)
        .then(r => r.ok ? r.json() : {})
        .then(trade => {
            document.getElementById('fs-outcome').textContent = trade.TradeOutcome || '-';
            document.getElementById('fs-pnl').textContent = trade.RealizedPL ? 
                (trade.RealizedPL > 0 ? '+' : '') + '$' + trade.RealizedPL.toFixed(2) : '-';
            document.getElementById('fs-strategy').textContent = trade.Strategy || '-';
            document.getElementById('fs-instrument').textContent = trade.FinInstrument || '-';
            document.getElementById('fs-score').textContent = '-';
        })
        .catch(e => console.error('Error loading trade:', e));
}

function saveFullscreenNotes() {
    if (!currentImage || !currentFolder) {
        alert('No image selected');
        return;
    }
    
    const notes = {};
    notes[currentImage] = document.getElementById('fullscreen-notes').value;
    
    fetch(`${API}/folder/${currentFolder}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notes)
    }).then(response => {
        if (response.ok) {
            showSuccess('fullscreen-notes-section', '✓ Notes saved');
        }
    }).catch(error => {
        console.error('Error saving notes:', error);
        showError('fullscreen-notes-section', 'Error saving notes');
    });
}

function replaceImage() {
    document.getElementById('image-input-replace').click();
}

function deleteImage() {
    if (!currentImage || !confirm(`Delete ${currentImage}?`)) return;
    
    fetch(`${API}/folder/${currentFolder}/image/${currentImage}`, {
        method: 'DELETE'
    }).then(response => {
        if (response.ok) {
            loadFolders();
            showSuccess('review', '✓ Image deleted');
        }
    }).catch(error => {
        console.error('Error deleting image:', error);
        showError('review', 'Error deleting image');
    });
}

// ============= Folder Management (Review Section) =============

async function loadFolders() {
    try {
        const response = await fetch(`${API}/folders`);
        allFolders = await response.json();

        // Populate ticker dropdown with folder names
        const tickerSelect = document.getElementById('review-ticker');
        tickerSelect.innerHTML = '<option value="">Select a trade...</option>';
        
        allFolders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.path;
            option.textContent = folder.name;
            option.dataset.folderData = JSON.stringify(folder);
            tickerSelect.appendChild(option);
        });

        if (allFolders.length === 0) {
            tickerSelect.innerHTML = '<option value="">No trades found. Create one first!</option>';
        }

        showSuccess('review', `✓ Loaded ${allFolders.length} trades`);
    } catch (error) {
        console.error('Error loading folders:', error);
        showError('review', 'Error loading folders');
    }
}

// Handle dropdown selection
function selectFolderByDropdown(folderPath) {
    if (!folderPath) {
        // Clear display if no selection
        document.getElementById('chart-image').innerHTML = '<div style="color: var(--color-text-tertiary); text-align: center; padding: 40px;">Select a trade from the dropdown</div>';
        document.getElementById('pnl-amount').textContent = '-';
        return;
    }
    selectFolder(folderPath);
}

async function selectFolder(folderPath) {
    currentFolder = folderPath;
    currentImageIndex = 0;
    
    try {
        const response = await fetch(`${API}/folders`);
        const folders = await response.json();
        const folder = folders.find(f => f.path === folderPath);

        if (folder && folder.images.length > 0) {
            currentFolderData = folder;
            currentImage = folder.images[0];
            displayImageAtIndex(folder);
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
    }
}

async function displayImageAtIndex(folder) {
    if (!folder || !folder.images || currentImageIndex >= folder.images.length) return;
    
    currentImage = folder.images[currentImageIndex];
    const imageUrl = `${API}/folder/${currentFolder}/image/${currentImage}`;
    
    // Display image
    document.getElementById('chart-image').innerHTML = `
        <img src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
    `;

    // Update image counter
    document.getElementById('image-counter').textContent = `Image ${currentImageIndex + 1} of ${folder.images.length} · ${currentImage}`;

    // Update notes title
    document.getElementById('notes-title').textContent = `Notes for ${currentImage}`;

    // Load trade info from Excel
    try {
        const tradeResponse = await fetch(`${API}/trade/${currentFolder}`);
        if (tradeResponse.ok) {
            const trade = await tradeResponse.json();
            displayTradeInfo(trade);
        }
    } catch (error) {
        console.error('Error loading trade info:', error);
    }

    // Load notes
    try {
        const notesResponse = await fetch(`${API}/folder/${currentFolder}/notes`);
        const notes = await notesResponse.json();
        document.getElementById('review-notes').value = notes[currentImage] || '';
        
        // Update timestamp
        const now = new Date();
        document.getElementById('notes-timestamp').textContent = 'Just now';
    } catch (error) {
        console.error('Error loading notes:', error);
    }
}

async function displayImage(folder) {
    currentFolderData = folder;
    displayImageAtIndex(folder);
}

function displayTradeInfo(trade) {
    // Outcome badge
    const outcomeClass = trade.TradeOutcome === 'Winner' ? 'winner' : 'loser';
    const outcomeText = trade.TradeOutcome === 'Winner' ? 'Winner' : 'Loser';
    document.getElementById('outcome-badge').textContent = outcomeText;
    document.getElementById('outcome-badge').className = `outcome-badge ${outcomeClass}`;
    
    // Strategy
    document.getElementById('strategy-badge').textContent = trade.Strategy || '-';
    
    // P&L
    const plAmount = document.getElementById('pnl-amount');
    const plPercent = document.getElementById('pnl-percent');
    plAmount.textContent = (trade.RealizedPL > 0 ? '+' : '') + '$' + trade.RealizedPL.toFixed(2);
    plAmount.style.color = trade.RealizedPL > 0 ? 'var(--color-success)' : 'var(--color-danger)';
    plPercent.textContent = (trade.RealizedPLPct > 0 ? '+' : '') + trade.RealizedPLPct.toFixed(2) + '%';
    
    // Trade Details
    document.getElementById('detail-instrument').textContent = trade.FinInstrument || '-';
    document.getElementById('detail-direction').textContent = trade.Direction || '-';
    document.getElementById('detail-tradetype').textContent = trade.TradeType || (trade.TradeLength ? (trade.TradeLength > 1440 ? 'Swing Trade' : 'Day Trade') : '-');
    document.getElementById('detail-score').textContent = '-';
    
    const scorePercent = 0;
    document.getElementById('score-fill').style.width = scorePercent + '%';
    
    // Prices
    document.getElementById('detail-entry-price').textContent = trade.AvgEntryPrice ? '$' + parseFloat(trade.AvgEntryPrice).toFixed(2) : '-';
    document.getElementById('detail-exit-price').textContent = trade.AvgExitPrice ? '$' + parseFloat(trade.AvgExitPrice).toFixed(2) : '-';
    document.getElementById('detail-position-value').textContent = trade.PositionValue ? '$' + parseFloat(trade.PositionValue).toFixed(2) : '-';
    
    // Timing
    document.getElementById('detail-entry-time').textContent = formatDateTime(trade.EntryDate, trade.EntryTime);
    document.getElementById('detail-exit-time').textContent = formatDateTime(trade.ExitDate, trade.ExitTime);
    document.getElementById('detail-duration').textContent = trade.TradeLength || '-';
    
    // Chart label
    document.getElementById('chart-description').textContent = (trade.FinInstrument || 'TRADE') + ' · 1D · Log + Indicators';
}

async function saveCurrentNotes() {
    if (!currentFolder || !currentImage) {
        alert('Please select a trade first');
        return;
    }

    const notes = {};
    notes[currentImage] = document.getElementById('review-notes').value;

    try {
        const response = await fetch(`${API}/folder/${currentFolder}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notes)
        });

        if (response.ok) {
            showSuccess('review', 'Notes saved successfully');
        }
    } catch (error) {
        console.error('Error saving notes:', error);
        showError('review', 'Error saving notes');
    }
}

// ============= Trade Creation (Create Section) =============

function updateSavePath() {
    const date = document.getElementById('create-date').value || 'YYYY-MM-DD';
    const ticker = document.getElementById('create-ticker').value || 'TICKER';
    let filename = '';
    
    // A or B comes FIRST
    const closeFlag = document.querySelector('input[name="close-flag"]:checked');
    if (closeFlag) {
        filename = closeFlag.value + '-';
    }
    
    // Then timeframe
    filename += document.getElementById('create-timeframe').value;
    
    // Then other flags
    if (document.getElementById('flag-i').checked) filename += '-I';
    if (document.getElementById('flag-l').checked) filename += '-L';
    if (document.getElementById('flag-o').checked) filename += '-O';

    document.getElementById('save-path').textContent = `${date}-${ticker} / ${filename}.png`;
}

async function uploadImage() {
    const ticker = document.getElementById('create-ticker').value;
    const date = document.getElementById('create-date').value;
    const imageInput = document.getElementById('image-input');
    const notes = document.getElementById('create-notes').value;

    if (!ticker || !date || !imageInput.files[0]) {
        alert('Please fill in Ticker, Date, and select an image');
        return;
    }

    let filename = '';
    
    // A or B comes FIRST
    const closeFlag = document.querySelector('input[name="close-flag"]:checked');
    if (closeFlag) {
        filename = closeFlag.value + '-';
    }
    
    // Then timeframe
    filename += document.getElementById('create-timeframe').value;
    
    // Then other flags
    if (document.getElementById('flag-i').checked) filename += '-I';
    if (document.getElementById('flag-l').checked) filename += '-L';
    if (document.getElementById('flag-o').checked) filename += '-O';
    filename += '.png';

    const folderName = `${date}-${ticker}`;
    const fullPath = `${folderName}/${filename}`;

    console.log('📝 Upload attempt:', { folderName, filename, fullPath });

    // Store data for potential upload
    window.pendingUpload = {
        folderName,
        filename,
        fullPath,
        image: imageInput.files[0],
        notes
    };

    // Check if file already exists
    try {
        console.log('🔍 Checking if file exists...');
        const checkResponse = await fetch(`${API}/folder/${encodeURIComponent(folderName)}/images`);
        
        console.log('✓ Check response status:', checkResponse.status);
        
        if (checkResponse.ok) {
            const folderData = await checkResponse.json();
            console.log('📂 Folder data:', folderData);
            
            // Handle different response formats
            const images = Array.isArray(folderData) ? folderData : (folderData.images || []);
            console.log('🖼️ Images in folder:', images);
            console.log('🔎 Looking for:', filename);
            
            const fileExists = images.includes(filename);
            console.log('⚠️ File exists?', fileExists);
            
            if (fileExists) {
                console.log('🚨 File exists! Showing warning...');
                showOverwriteDialog(fullPath);
                return;
            } else {
                console.log('✓ File is new, proceeding with upload');
            }
        } else {
            console.log('⚠️ Check failed (not found), assuming new file');
        }
    } catch (error) {
        console.error('❌ Error checking file:', error);
        console.log('⚠️ Check failed, proceeding with upload anyway');
    }

    // File doesn't exist, proceed with upload
    console.log('▶️ Starting upload...');
    await doUpload();
}

async function doUpload() {
    console.log('🔄 doUpload started');
    const upload = window.pendingUpload;
    
    if (!upload) {
        console.error('❌ No pending upload data!');
        alert('Error: No upload data. Please try again.');
        return;
    }

    console.log('📦 Upload data:', upload);

    const formData = new FormData();
    formData.append('folder_name', upload.folderName);
    formData.append('image', upload.image);
    formData.append('filename', upload.filename);
    formData.append('notes', upload.notes);

    console.log('📨 FormData prepared:', {
        folderName: upload.folderName,
        filename: upload.filename,
        imageSize: upload.image.size,
        notesLength: upload.notes.length
    });

    try {
        console.log('🚀 Sending request to:', `${API}/folder`);
        const response = await fetch(`${API}/folder`, {
            method: 'POST',
            body: formData
        });

        console.log('📬 Response received, status:', response.status);
        
        let result;
        try {
            result = await response.json();
            console.log('✓ JSON parsed:', result);
        } catch (parseError) {
            console.error('❌ Failed to parse response as JSON:', parseError);
            const text = await response.text();
            console.log('Raw response:', text);
            showError('create', 'Server error: Invalid response');
            return;
        }
        
        if (result.success) {
            console.log('✅ Upload successful!');
            showSuccess('create', `✓ Saved to ${result.folder}/${result.filename}`);
            
            // Reset form
            const imageInput = document.getElementById('image-input');
            imageInput.value = '';
            document.getElementById('create-notes').value = '';
            document.getElementById('flag-i').checked = false;
            document.getElementById('flag-l').checked = false;
            document.getElementById('flag-o').checked = false;
            document.querySelectorAll('input[name="close-flag"]').forEach(radio => {
                radio.checked = false;
            });
            
            // Reset image preview
            const imagePreview = document.getElementById('image-preview');
            imagePreview.innerHTML = `
                <div class="image-preview-content">
                    <div class="image-upload-icon">📸</div>
                    <div class="image-upload-text">
                        <p><strong>Drag & drop</strong> or paste image</p>
                        <p style="font-size: 12px; color: var(--color-text-tertiary);">Paste with Ctrl+V</p>
                    </div>
                </div>
            `;
            imagePreview.classList.remove('has-image');
            
            // Hide clear button
            document.getElementById('clear-image-btn').style.display = 'none';
            
            updateSavePath();

            // Reload folders
            console.log('🔄 Reloading folders...');
            await loadFolders();
            console.log('✓ Folders reloaded');
            
            // Clear pending upload
            window.pendingUpload = null;
            console.log('✓ Upload complete!');
        } else {
            console.error('❌ Upload failed:', result.error);
            showError('create', result.error || 'Error uploading image');
        }
    } catch (error) {
        console.error('❌ Fetch error:', error);
        console.error('Error details:', error.message, error.stack);
        showError('create', 'Error uploading image: ' + error.message);
    }
}

function showOverwriteDialog(filepath) {
    console.log('🎯 showOverwriteDialog called with:', filepath);
    const dialog = document.getElementById('overwrite-dialog');
    const filename = document.getElementById('overwrite-filename');
    
    if (!dialog) {
        console.error('❌ Dialog element not found!');
        alert(`File already exists: ${filepath}\n\nReplace it?`);
        confirmOverwrite();
        return;
    }
    
    if (!filename) {
        console.error('❌ Filename element not found!');
    }
    
    filename.textContent = filepath;
    console.log('📝 Set filename to:', filepath);
    
    dialog.classList.add('active');
    console.log('✓ Dialog shown');
}

function closeOverwriteDialog() {
    console.log('🚫 [BUTTON CLICKED] closeOverwriteDialog');
    const dialog = document.getElementById('overwrite-dialog');
    
    if (!dialog) {
        console.error('❌ Dialog element not found!');
        return;
    }
    
    dialog.classList.remove('active');
    window.pendingUpload = null;
    console.log('✓ Dialog hidden, pending upload cleared');
}

function confirmOverwrite() {
    console.log('✅ [BUTTON CLICKED] confirmOverwrite');
    console.log('📦 Pending upload data before upload:', window.pendingUpload);
    
    // Hide dialog WITHOUT clearing pending upload
    const dialog = document.getElementById('overwrite-dialog');
    if (dialog) {
        dialog.classList.remove('active');
        console.log('✓ Dialog hidden (keeping upload data)');
    }
    
    console.log('⏳ Starting upload via doUpload()...');
    doUpload();
}

// Diagnostic functions (for testing)
function testOverwriteDialog() {
    console.log('🧪 Testing overwrite dialog...');
    const dialog = document.getElementById('overwrite-dialog');
    const filename = document.getElementById('overwrite-filename');
    
    if (!dialog) {
        console.error('❌ Dialog not found in DOM');
        return false;
    }
    if (!filename) {
        console.error('❌ Filename element not found in DOM');
        return false;
    }
    
    console.log('✓ Dialog elements exist');
    
    // Test showing
    showOverwriteDialog('TEST_FILE.png');
    
    setTimeout(() => {
        if (dialog.classList.contains('active')) {
            console.log('✓ Dialog can be shown');
        } else {
            console.error('❌ Dialog.active class not being applied');
        }
    }, 100);
    
    return true;
}

// Call this in browser console to test: testOverwriteDialog()

// ============= Analytics (Analyze Section) =============

async function loadTrades() {
    console.log('📥 loadTrades() called');
    try {
        const response = await fetch(`${API}/trades`);
        console.log('📬 Response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Data received:', data?.length, 'trades');
        
        window.allTrades = data;
        console.log('✓ window.allTrades set to:', window.allTrades?.length, 'trades');
        
        if (window.allTrades && window.allTrades.length > 0) {
            console.log('📋 First trade:', window.allTrades[0]);
            console.log('📋 Last trade:', window.allTrades[window.allTrades.length - 1]);
        }
        
        displayTradesTable();
        return data;
    } catch (error) {
        console.error('❌ Error loading trades:', error);
        window.allTrades = [];
        return [];
    }
}

function displayTradesTable() {
    const tbody = document.getElementById('trades-body');
    tbody.innerHTML = allTrades.slice(0, 50).map(trade => `
        <tr>
            <td style="font-size: 12px;">${formatDate(trade.EntryDate)}</td>
            <td style="font-size: 11px;">${trade.FinInstrument}</td>
            <td style="font-size: 12px;">${trade.Strategy}</td>
            <td style="color: ${trade.RealizedPL > 0 ? 'var(--color-success)' : 'var(--color-danger)'}; font-weight: 600;">
                ${trade.RealizedPL > 0 ? '+' : ''}$${trade.RealizedPL.toFixed(2)}
            </td>
            <td><span class="badge ${trade.TradeOutcome === 'Winner' ? 'success' : 'danger'}">${trade.TradeOutcome}</span></td>
            <td style="font-size: 12px;">${(trade.RealizedPLPct || 0).toFixed(1)}%</td>
        </tr>
    `).join('');
}

async function loadStats() {
    try {
        const response = await fetch(`${API}/stats`);
        const stats = await response.json();
        displayStats(stats);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

function displayStats(stats) {
    document.getElementById('kpi-cards').innerHTML = `
        <div class="kpi-card">
            <div class="kpi-label">Net P&L</div>
            <div class="kpi-value ${stats.net_pl > 0 ? 'positive' : 'negative'}">
                ${stats.net_pl > 0 ? '+' : ''}$${Math.round(stats.net_pl)}
            </div>
            <div class="kpi-label" style="margin-top: 8px;">${stats.total_trades} trades</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Win Rate</div>
            <div class="kpi-value">${stats.win_rate.toFixed(1)}%</div>
            <div class="kpi-label" style="margin-top: 8px;">${stats.winners}W / ${stats.losers}L</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Profit Factor</div>
            <div class="kpi-value">${stats.profit_factor.toFixed(2)}</div>
            <div class="kpi-label" style="margin-top: 8px;">wins ÷ losses</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Expectancy</div>
            <div class="kpi-value ${stats.expectancy > 0 ? 'positive' : 'negative'}">
                ${stats.expectancy > 0 ? '+' : ''}$${stats.expectancy.toFixed(2)}
            </div>
            <div class="kpi-label" style="margin-top: 8px;">per trade</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Max Drawdown</div>
            <div class="kpi-value negative">${stats.max_drawdown.toFixed(2)}</div>
            <div class="kpi-label" style="margin-top: 8px;">peak to trough</div>
        </div>
    `;
}

// ============= Chart Initialization =============

function initCharts() {
    initEquityChart();
    initDailyChart();
}

function initEquityChart() {
    const ctx = document.getElementById('equityChart')?.getContext('2d');
    if (!ctx) return;

    charts.equity = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Apr 2','Apr 6','Apr 7','Apr 8','Apr 9','Apr 10','Apr 13','Apr 14','Apr 15','Apr 16','Apr 17','Apr 20','Apr 21','Apr 22','Apr 23','Apr 24','Apr 27','Apr 28','Apr 29','Apr 30'],
            datasets: [{
                label: 'Cumulative P&L',
                data: [118,79,155,258,480,695,753,842,897,996,1249,1514,1578,1612,1950,2380,2824,3183,3405,3324],
                borderColor: '#639922',
                backgroundColor: 'rgba(99,153,34,0.1)',
                tension: 0.3,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 5,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => '$' + Math.round(ctx.parsed.y).toLocaleString()
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (v) => '$' + v.toLocaleString()
                    },
                    grid: { color: 'rgba(127,127,127,0.1)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}


function initDailyChart() {
    const ctx = document.getElementById('dailyChart')?.getContext('2d');
    if (!ctx) return;

    charts.daily = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Apr 2','Apr 6','Apr 7','Apr 8','Apr 9','Apr 10','Apr 13','Apr 14','Apr 15','Apr 16','Apr 17','Apr 20','Apr 21','Apr 22','Apr 23','Apr 24','Apr 27','Apr 28','Apr 29','Apr 30'],
            datasets: [{
                label: 'Daily P&L',
                data: [118,-39,76,102,223,214,58,89,55,99,253,264,64,34,339,430,444,359,222,-82],
                backgroundColor: (ctx) => ctx.raw >= 0 ? '#639922' : '#a32d2d',
                borderRadius: 2,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => (ctx.raw >= 0 ? '+$' : '-$') + Math.abs(Math.round(ctx.raw)).toLocaleString()
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: (v) => '$' + v
                    },
                    grid: { color: 'rgba(127,127,127,0.1)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function initDashboard() {
    console.log('📊 Initializing dashboard');
    loadStats();
    initEquityChart();
    
    setTimeout(() => {
        populateByStrategy();
        populateByAssetType();
        populateByDayOfWeek();
        initTradeTimeChart();
    }, 100);
}

function loadStats() {
    console.log('📈 Loading dashboard statistics');
    
    if (!window.allTrades || window.allTrades.length === 0) {
        console.warn('No trades available');
        return;
    }

    const trades = window.allTrades;
    const wins = trades.filter(t => t.RealizedPL > 0);
    const losses = trades.filter(t => t.RealizedPL < 0);
    
    const stats = {
        netPL: trades.reduce((sum, t) => sum + (t.RealizedPL || 0), 0),
        winRate: (wins.length / trades.length * 100).toFixed(1),
        profitFactor: (wins.reduce((sum, t) => sum + (t.RealizedPL || 0), 0) / Math.abs(losses.reduce((sum, t) => sum + (t.RealizedPL || 0), 0))).toFixed(2),
        expectancy: (trades.reduce((sum, t) => sum + (t.RealizedPL || 0), 0) / trades.length).toFixed(2),
        maxDrawdown: -260,  // Placeholder - would need cumulative calc
        totalTrades: trades.length,
        winCount: wins.length,
        lossCount: losses.length
    };

    displayKPIs(stats);
}

function displayKPIs(stats) {
    const kpiHtml = `
        <div class="kpi-card">
            <div class="kpi-value" style="color: var(--color-success);">+$${Math.abs(stats.netPL).toFixed(0)}</div>
            <div class="kpi-label">Net P&L</div>
            <div class="kpi-sub">${stats.totalTrades} trades</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-value">${stats.winRate}%</div>
            <div class="kpi-label">Win rate</div>
            <div class="kpi-sub">${stats.winCount} W / ${stats.lossCount} L</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-value">${stats.profitFactor}</div>
            <div class="kpi-label">Profit factor</div>
            <div class="kpi-sub">wins ÷ losses</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-value">+$${stats.expectancy}</div>
            <div class="kpi-label">Expectancy</div>
            <div class="kpi-sub">per trade</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-value" style="color: var(--color-danger);">${stats.maxDrawdown}</div>
            <div class="kpi-label">Max drawdown</div>
            <div class="kpi-sub">peak to trough</div>
        </div>
    `;
    
    document.getElementById('kpi-cards').innerHTML = kpiHtml;
}

function populateByStrategy() {
    console.log('📊 Calculating by strategy');
    
    if (!window.allTrades) return;
    
    const byStrategy = {};
    window.allTrades.forEach(trade => {
        const strategy = trade.TradeStrategy || 'Unknown';
        if (!byStrategy[strategy]) {
            byStrategy[strategy] = { trades: 0, pnl: 0, wins: 0 };
        }
        byStrategy[strategy].trades += 1;
        byStrategy[strategy].pnl += trade.RealizedPL || 0;
        if ((trade.RealizedPL || 0) > 0) byStrategy[strategy].wins += 1;
    });
    
    let html = '';
    Object.entries(byStrategy).forEach(([strategy, data]) => {
        const wr = ((data.wins / data.trades) * 100).toFixed(0);
        html += `
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-weight: 600;">${strategy}</span>
                    <span style="color: ${data.pnl > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">+$${data.pnl.toFixed(0)}</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; font-size: 12px; color: var(--color-text-secondary);">
                    <div style="flex: 1; height: 6px; background: var(--color-success); border-radius: 3px; width: ${wr}%;"></div>
                    <span>${data.trades} · ${wr}%</span>
                </div>
            </div>
        `;
    });
    
    document.getElementById('by-strategy-list').innerHTML = html;
}

function populateByAssetType() {
    console.log('📊 Calculating by asset type');
    
    if (!window.allTrades) return;
    
    const byAsset = {};
    window.allTrades.forEach(trade => {
        const type = trade.FinInstrument?.includes('OPT') || trade.FinInstrument?.includes('CALL') || trade.FinInstrument?.includes('PUT') ? 'Options' : 'Stock';
        if (!byAsset[type]) {
            byAsset[type] = { trades: 0, pnl: 0, wins: 0 };
        }
        byAsset[type].trades += 1;
        byAsset[type].pnl += trade.RealizedPL || 0;
        if ((trade.RealizedPL || 0) > 0) byAsset[type].wins += 1;
    });
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; font-size: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin-bottom: 12px;"><div style="font-weight: 600;">Type</div><div style="text-align: center; font-weight: 600;">N</div><div style="text-align: center; font-weight: 600;">Win %</div><div style="text-align: right; font-weight: 600;">Net</div></div>';
    
    Object.entries(byAsset).forEach(([type, data]) => {
        const wr = ((data.wins / data.trades) * 100).toFixed(0);
        html += `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; font-size: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border);">
                <div>${type}</div>
                <div style="text-align: center;">${data.trades}</div>
                <div style="text-align: center;">${wr}%</div>
                <div style="text-align: right; color: ${data.pnl > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">+$${data.pnl.toFixed(0)}</div>
            </div>
        `;
    });
    
    document.getElementById('by-asset-list').innerHTML = html;
}

function populateByDayOfWeek() {
    console.log('📊 Calculating by day of week');
    
    if (!window.allTrades) return;
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const byDay = {};
    days.forEach(d => byDay[d] = { trades: 0, pnl: 0, wins: 0 });
    
    window.allTrades.forEach(trade => {
        const date = new Date(trade.EntryDate);
        const dayIndex = (date.getDay() + 6) % 7; // Convert JS day (Sun=0) to Mon=0
        const dayName = days[dayIndex] || days[0];
        
        if (!byDay[dayName]) {
            byDay[dayName] = { trades: 0, pnl: 0, wins: 0 };
        }
        byDay[dayName].trades += 1;
        byDay[dayName].pnl += trade.RealizedPL || 0;
        if ((trade.RealizedPL || 0) > 0) byDay[dayName].wins += 1;
    });
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; font-size: 12px; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin-bottom: 12px;"><div style="font-weight: 600;">Day</div><div style="text-align: center; font-weight: 600;">N</div><div style="text-align: center; font-weight: 600;">Win %</div><div style="text-align: right; font-weight: 600;">Net</div></div>';
    
    days.forEach(dayName => {
        const data = byDay[dayName];
        if (data.trades === 0) return;
        const wr = ((data.wins / data.trades) * 100).toFixed(0);
        html += `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; font-size: 12px; padding: 8px 0; border-bottom: 1px solid var(--color-border);">
                <div>${dayName}</div>
                <div style="text-align: center;">${data.trades}</div>
                <div style="text-align: center;">${wr}%</div>
                <div style="text-align: right; color: ${data.pnl > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">+$${data.pnl.toFixed(0)}</div>
            </div>
        `;
    });
    
    document.getElementById('by-dow-list').innerHTML = html;
}

function initTradeTimeChart() {
    console.log('🎯 Initializing trade time chart');
    
    if (!window.allTrades) return;
    
    const ctx = document.getElementById('tradeTimeChart');
    if (!ctx) return;
    
    // Extract hour from entry time and create scatter data
    const scatterData = window.allTrades.map(trade => {
        const entryTime = trade.EntryTime || '12:00';
        const hour = parseInt(entryTime.split(':')[0]);
        return {
            x: hour,
            y: trade.RealizedPL || 0,
            isWinner: (trade.RealizedPL || 0) > 0
        };
    });
    
    charts.tradeTime = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Winners',
                    data: scatterData.filter(d => d.isWinner).map(d => ({ x: d.x, y: d.y })),
                    backgroundColor: 'rgba(99, 153, 34, 0.6)',
                    borderColor: 'rgba(99, 153, 34, 1)',
                    pointRadius: 6
                },
                {
                    label: 'Losers',
                    data: scatterData.filter(d => !d.isWinner).map(d => ({ x: d.x, y: d.y })),
                    backgroundColor: 'rgba(163, 45, 45, 0.6)',
                    borderColor: 'rgba(163, 45, 45, 1)',
                    pointRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    min: 5,
                    max: 20,
                    title: {
                        display: true,
                        text: 'Entry Hour (ET)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'P&L ($)'
                    }
                }
            }
        }
    });
}

function setDateRange(range) {
    console.log('📅 Setting date range:', range);
    const today = new Date();
    let from, to = new Date();
    
    switch(range) {
        case '7d':
            from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'ytd':
            from = new Date(to.getFullYear(), 0, 1);
            break;
        case 'all':
            from = new Date('2000-01-01');
            break;
    }
    
    document.getElementById('dateFrom').value = from.toISOString().split('T')[0];
    document.getElementById('dateTo').value = to.toISOString().split('T')[0];
}

// ============= P&L View Functions =============

let currentPnlView = 'daily';

function switchPnlView(view) {
    console.log('📊 Switching to', view, 'view');
    
    currentPnlView = view;
    
    // Update button states - find and update all buttons
    const buttons = document.querySelectorAll('.pnl-view-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find the button that was clicked and mark it active
    buttons.forEach(btn => {
        if (btn.textContent.toLowerCase() === view) {
            btn.classList.add('active');
        }
    });
    
    console.log('🔘 Button updated to:', view);
    
    // Get data based on view
    if (!window.allTrades || window.allTrades.length === 0) {
        console.warn('⚠️ No trade data available');
        return;
    }
    
    console.log('✓ Trades available:', window.allTrades.length);
    
    let labels, data, title;
    
    if (view === 'daily') {
        const result = getPnLByDay();
        labels = result.labels;
        data = result.data;
        title = 'Daily P&L';
        console.log('📅 Daily: labels=' + labels.length + ', data=' + data.length);
    } else if (view === 'weekly') {
        const result = getPnLByWeek();
        labels = result.labels;
        data = result.data;
        title = 'Weekly P&L';
        console.log('📊 Weekly: labels=' + labels.length + ', data=' + data.length);
    } else if (view === 'monthly') {
        const result = getPnLByMonth();
        labels = result.labels;
        data = result.data;
        title = 'Monthly P&L';
        console.log('📈 Monthly: labels=' + labels.length + ', data=' + data.length);
    }
    
    console.log('Chart data ready:', { labels, data, title });
    
    // Update chart
    updatePnLChart(labels, data, title);
}

function getPnLByDay() {
    console.log('📅 Calculating daily P&L');
    const dailyPnL = {};
    
    window.allTrades.forEach(trade => {
        const date = trade.EntryDate;
        if (!dailyPnL[date]) {
            dailyPnL[date] = 0;
        }
        dailyPnL[date] += trade.RealizedPL || 0;
    });
    
    // Sort by date
    const sorted = Object.entries(dailyPnL).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    
    return {
        labels: sorted.map(([date]) => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        }),
        data: sorted.map(([_, pnl]) => Math.round(pnl))
    };
}

function getPnLByWeek() {
    console.log('📊 Calculating weekly P&L');
    const weeklyPnL = {};
    
    window.allTrades.forEach(trade => {
        const date = new Date(trade.EntryDate);
        // Get Monday of that week
        const monday = new Date(date);
        monday.setDate(date.getDate() - date.getDay() + 1);
        const weekKey = monday.toISOString().split('T')[0];
        
        if (!weeklyPnL[weekKey]) {
            weeklyPnL[weekKey] = 0;
        }
        weeklyPnL[weekKey] += trade.RealizedPL || 0;
    });
    
    // Sort by date
    const sorted = Object.entries(weeklyPnL).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    
    return {
        labels: sorted.map(([date]) => {
            const d = new Date(date);
            const endDate = new Date(d);
            endDate.setDate(d.getDate() + 6);
            return `Week ${d.getMonth() + 1}/${d.getDate()}-${endDate.getMonth() + 1}/${endDate.getDate()}`;
        }),
        data: sorted.map(([_, pnl]) => Math.round(pnl))
    };
}

function getPnLByMonth() {
    console.log('📈 Calculating monthly P&L');
    const monthlyPnL = {};
    
    window.allTrades.forEach(trade => {
        const date = new Date(trade.EntryDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyPnL[monthKey]) {
            monthlyPnL[monthKey] = 0;
        }
        monthlyPnL[monthKey] += trade.RealizedPL || 0;
    });
    
    // Sort by date
    const sorted = Object.entries(monthlyPnL).sort((a, b) => new Date(a[0]) - new Date(b[0]));
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return {
        labels: sorted.map(([monthKey]) => {
            const [year, month] = monthKey.split('-');
            return `${monthNames[parseInt(month) - 1]} ${year}`;
        }),
        data: sorted.map(([_, pnl]) => Math.round(pnl))
    };
}

function updatePnLChart(labels, data, title) {
    console.log('🔄 Updating chart:', title);
    console.log('   Labels:', labels);
    console.log('   Data:', data);
    
    if (!charts.daily) {
        console.error('❌ Chart not initialized');
        return;
    }
    
    // Update data
    charts.daily.data.labels = labels;
    charts.daily.data.datasets[0].label = title;
    charts.daily.data.datasets[0].data = data;
    
    // Force update
    charts.daily.update('none');  // 'none' = no animation, instant update
    
    console.log('✅ Chart updated successfully');
}

function formatDate(dateStr) {
    try {
        return new Date(dateStr).toLocaleDateString();
    } catch {
        return dateStr;
    }
}

function formatDateTime(dateStr, timeStr) {
    try {
        if (!dateStr) return '-';
        const date = new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const time = timeStr ? timeStr.substring(0, 5) : '';
        return time ? `${date}, ${time}` : date;
    } catch {
        return dateStr;
    }
}

function formatDuration(minutes) {
    if (!minutes) return '-';
    if (minutes < 60) return minutes + ' min';
    if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    const days = Math.floor(minutes / 1440);
    const restMins = minutes % 1440;
    return restMins > 0 ? `${days}d ${Math.floor(restMins/60)}h` : `${days}d`;
}

function showSuccess(sectionId, message) {
    const msg = document.createElement('div');
    msg.className = 'status-message success';
    msg.textContent = message;
    
    const section = document.getElementById(sectionId);
    const firstCard = section.querySelector('.card') || section.querySelector('.filter-bar');
    
    if (firstCard) {
        firstCard.insertAdjacentElement('beforebegin', msg);
    } else {
        section.insertBefore(msg, section.firstChild);
    }
    
    setTimeout(() => msg.remove(), 3000);
}

function showError(sectionId, message) {
    const msg = document.createElement('div');
    msg.className = 'status-message error';
    msg.textContent = '❌ ' + message;
    
    const section = document.getElementById(sectionId);
    const firstCard = section.querySelector('.card') || section.querySelector('.filter-bar');
    
    if (firstCard) {
        firstCard.insertAdjacentElement('beforebegin', msg);
    } else {
        section.insertBefore(msg, section.firstChild);
    }
    
    setTimeout(() => msg.remove(), 4000);
}

// ============= Radar Chart Functions =============

function initRadarChart() {
    console.log('🎯 Initializing radar chart');
    
    const ctx = document.getElementById('radarChart');
    if (!ctx) {
        console.warn('Canvas not found');
        return;
    }

    // Calculate metrics
    const metrics = calculatePerformanceMetrics();
    
    // Normalize to 0-100 scale for radar
    const radarData = [
        metrics.winRateNormalized,
        metrics.profitFactorNormalized,
        metrics.consistencyScore,
        metrics.maxDrawdownScore,
        metrics.recoveryFactorNormalized,
        metrics.winLossRatioNormalized
    ];

    charts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: [
                'Win Rate',
                'Profit Factor',
                'Consistency',
                'Max Drawdown',
                'Recovery Factor',
                'Win/Loss Ratio'
            ],
            datasets: [{
                label: 'Trading Performance',
                data: radarData,
                borderColor: 'rgba(139, 92, 246, 1)',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                borderWidth: 2,
                pointRadius: 6,
                pointBackgroundColor: 'rgba(139, 92, 246, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        stepSize: 20,
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(139, 92, 246, 0.1)'
                    }
                }
            }
        }
    });
    
    // Update metrics display
    updateMetricsDisplay(metrics);
    updateAssessment(metrics);
    
    console.log('✓ Radar chart initialized');
}

function calculatePerformanceMetrics() {
    console.log('📊 Calculating performance metrics');
    
    if (!window.allTrades || window.allTrades.length === 0) {
        return getDefaultMetrics();
    }

    const trades = window.allTrades;
    
    // Basic stats
    const wins = trades.filter(t => t.RealizedPL > 0);
    const losses = trades.filter(t => t.RealizedPL < 0);
    const winCount = wins.length;
    const lossCount = losses.length;
    const totalTrades = trades.length;
    
    // Profit metrics
    const totalWins = wins.reduce((sum, t) => sum + (t.RealizedPL || 0), 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.RealizedPL || 0), 0));
    const netProfit = totalWins - totalLosses;
    
    // Win rate
    const winRate = (winCount / totalTrades) * 100;
    
    // Profit factor
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;
    
    // Average win/loss
    const avgWin = winCount > 0 ? totalWins / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLosses / lossCount : 0;
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    // Consistency (inverse of daily volatility)
    const dailyReturns = calculateDailyReturns();
    const consistency = calculateConsistencyScore(dailyReturns);
    
    // Max drawdown and recovery factor
    const { maxDrawdown, recoveryFactor } = calculateDrawdownMetrics();
    
    // Normalize values to 0-100 scale
    const metrics = {
        winRate: winRate,
        winRateNormalized: Math.min(winRate, 100),
        
        profitFactor: profitFactor,
        profitFactorNormalized: Math.min((profitFactor / 10) * 100, 100),
        
        consistency: consistency,
        consistencyScore: consistency,
        
        winLossRatio: winLossRatio,
        winLossRatioNormalized: Math.min((winLossRatio * 50), 100),
        
        maxDrawdown: maxDrawdown,
        maxDrawdownScore: 100 - maxDrawdown,
        
        recoveryFactor: recoveryFactor,
        recoveryFactorNormalized: Math.min((recoveryFactor * 10), 100),
        
        // Raw values for display
        totalWins: totalWins,
        totalLosses: totalLosses,
        netProfit: netProfit,
        avgWin: avgWin,
        avgLoss: avgLoss,
        winCount: winCount,
        lossCount: lossCount
    };
    
    console.log('✓ Metrics calculated:', metrics);
    return metrics;
}

function calculateDailyReturns() {
    const trades = window.allTrades;
    const dailyPnL = {};
    
    trades.forEach(trade => {
        const date = trade.EntryDate;
        if (!dailyPnL[date]) {
            dailyPnL[date] = 0;
        }
        dailyPnL[date] += trade.RealizedPL || 0;
    });
    
    return Object.values(dailyPnL);
}

function calculateConsistencyScore(dailyReturns) {
    if (dailyReturns.length === 0) return 0;
    
    // Calculate mean
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    
    // Calculate standard deviation
    const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyReturns.length;
    const stdDev = Math.sqrt(variance);
    
    // Consistency = inverse of volatility
    const consistency = Math.max(0, 100 - (stdDev / Math.abs(mean || 1)) * 20);
    
    return Math.min(consistency, 100);
}

function calculateDrawdownMetrics() {
    const trades = window.allTrades;
    
    // Calculate cumulative P&L
    let cumulativePnL = 0;
    let peak = 0;
    let maxDrawdown = 0;
    
    trades.forEach(trade => {
        cumulativePnL += trade.RealizedPL || 0;
        
        if (cumulativePnL > peak) {
            peak = cumulativePnL;
        }
        
        const drawdown = ((peak - cumulativePnL) / peak) * 100;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    });
    
    // Recovery factor = net profit / max drawdown
    const netProfit = cumulativePnL;
    const recoveryFactor = maxDrawdown > 0 ? netProfit / (netProfit * (maxDrawdown / 100)) : 0;
    
    return {
        maxDrawdown: maxDrawdown,
        recoveryFactor: Math.min(recoveryFactor, 100)
    };
}

function updateMetricsDisplay(metrics) {
    console.log('📈 Updating metrics display');
    
    // Win Rate
    document.getElementById('metric-winrate').textContent = metrics.winRate.toFixed(1) + '%';
    document.getElementById('bar-winrate').style.width = metrics.winRateNormalized + '%';
    document.getElementById('desc-winrate').textContent = `${metrics.winCount} wins / ${metrics.lossCount} losses`;
    
    // Profit Factor
    document.getElementById('metric-profitfactor').textContent = metrics.profitFactor.toFixed(2);
    document.getElementById('bar-profitfactor').style.width = metrics.profitFactorNormalized + '%';
    document.getElementById('desc-profitfactor').textContent = `$${metrics.totalWins.toFixed(0)} wins ÷ $${metrics.totalLosses.toFixed(0)} losses`;
    
    // Consistency
    document.getElementById('metric-consistency').textContent = metrics.consistency.toFixed(1);
    document.getElementById('bar-consistency').style.width = metrics.consistencyScore + '%';
    document.getElementById('desc-consistency').textContent = 'Daily returns volatility';
    
    // Max Drawdown
    document.getElementById('metric-drawdown').textContent = (100 - metrics.maxDrawdown).toFixed(1);
    document.getElementById('bar-drawdown').style.width = metrics.maxDrawdownScore + '%';
    document.getElementById('desc-drawdown').textContent = `Only -${metrics.maxDrawdown.toFixed(1)}% below peak`;
    
    // Recovery Factor
    document.getElementById('metric-recovery').textContent = metrics.recoveryFactor.toFixed(1);
    document.getElementById('bar-recovery').style.width = metrics.recoveryFactorNormalized + '%';
    document.getElementById('desc-recovery').textContent = 'Quick bounce back from dips';
    
    // Win/Loss Ratio
    document.getElementById('metric-winloss').textContent = metrics.winLossRatio.toFixed(2);
    document.getElementById('bar-winloss').style.width = metrics.winLossRatioNormalized + '%';
    document.getElementById('desc-winloss').textContent = `Avg win $${metrics.avgWin.toFixed(0)} / avg loss -$${metrics.avgLoss.toFixed(0)}`;
}

function updateAssessment(metrics) {
    console.log('📝 Updating assessment');
    
    const strengths = [];
    const areas = [];
    
    // Identify strengths
    if (metrics.profitFactor > 3) {
        strengths.push('Exceptional profit factor (' + metrics.profitFactor.toFixed(2) + ')');
    }
    if (metrics.maxDrawdown < 10) {
        strengths.push('Fast recovery from drawdowns');
    }
    if (metrics.winLossRatio > 1.5) {
        strengths.push('Balanced win/loss sizing');
    }
    if (metrics.winRate > 70) {
        strengths.push('High win rate consistency');
    }
    
    // Identify areas to watch
    if (metrics.winRate < 55) {
        areas.push('Win rate below 55% threshold');
    }
    if (metrics.maxDrawdown > 20) {
        areas.push('Significant drawdown risk');
    }
    if (metrics.consistency < 60) {
        areas.push('High daily volatility');
    }
    
    // Generate assessment
    const assessmentTexts = [
        'Strong trader. Focus on time-of-day patterns and explore why Brando strategy outperforms.',
        'Solid performance with focus on consistency improvements.',
        'Excellent risk management and profit generation.',
        'Good foundation - consider strategy refinement for next level.'
    ];
    
    let assessmentIndex = 0;
    if (metrics.winRate > 75 && metrics.profitFactor > 6) {
        assessmentIndex = 2;
    } else if (metrics.winRate > 65 && metrics.profitFactor > 3) {
        assessmentIndex = 1;
    }
    
    document.getElementById('assessment-text').textContent = assessmentTexts[assessmentIndex];
    
    // Update strengths list
    const strengthsList = document.getElementById('strengths-list');
    strengthsList.innerHTML = strengths.length > 0
        ? strengths.map(s => `<li style="margin-bottom: 8px;">• ${s}</li>`).join('')
        : '<li>• Keep building on current momentum</li>';
    
    // Update areas list
    const areasList = document.getElementById('areas-list');
    areasList.innerHTML = areas.length > 0
        ? areas.map(a => `<li style="margin-bottom: 8px;">• ${a}</li>`).join('')
        : '<li>• All systems performing well</li>';
}

function getDefaultMetrics() {
    return {
        winRate: 0,
        winRateNormalized: 0,
        profitFactor: 0,
        profitFactorNormalized: 0,
        consistency: 0,
        consistencyScore: 0,
        winLossRatio: 0,
        winLossRatioNormalized: 0,
        maxDrawdown: 0,
        maxDrawdownScore: 0,
        recoveryFactor: 0,
        recoveryFactorNormalized: 0,
        totalWins: 0,
        totalLosses: 0,
        netProfit: 0,
        avgWin: 0,
        avgLoss: 0,
        winCount: 0,
        lossCount: 0
    };
}
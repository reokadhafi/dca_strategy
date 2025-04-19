$(document).ready(function () {
    const coins = ['XRPUSDT', 'BGBUSDT', 'PEPEUSDT', 'SHIBUSDT'];
    let coinPrices = {};
    
    // Fungsi untuk menyimpan semua data ke localStorage
    function saveAllData() {
        const purchases = [];
        $('.purchase-row').each(function () {
            purchases.push({
                coin: $(this).data('coin'),
                buyPrice: $(this).find('.buy-price').val(),
                usdtAmount: $(this).find('.usdt-amount').val(),
                timestamp: $(this).data('timestamp') || Date.now()
            });
        });
        
        const portfolioData = {
            purchases: purchases,
            lastUpdated: Date.now()
        };
        
        localStorage.setItem('cryptoDCAStorage', JSON.stringify(portfolioData));
        console.log("Data tersimpan!");
    }
    
    // Fungsi untuk memuat data dari localStorage
    function loadAllData() {
        const savedData = localStorage.getItem('cryptoDCAStorage');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                
                // Clear existing purchases
                $('#purchases').empty();
                
                // Add saved purchases
                data.purchases.forEach(purchase => {
                    addPurchaseRow(
                        purchase.coin, 
                        purchase.buyPrice, 
                        purchase.usdtAmount,
                        purchase.timestamp
                    );
                });
                
                console.log("Data dimuat!");
                return true;
            } catch (e) {
                console.error("Error parsing saved data:", e);
                return false;
            }
        }
        return false;
    }
    
    // Fungsi untuk menambahkan baris pembelian
    function addPurchaseRow(coin, buyPrice, usdtAmount, timestamp) {
        const row = $(`
            <tr class="purchase-row" data-coin="${coin}" data-timestamp="${timestamp || Date.now()}">
                <td>${coin}</td>
                <td><input type="number" class="buy-price" value="${buyPrice || ''}" placeholder="Buy Price (USDT)" step="0.00000001"></td>
                <td><input type="number" class="usdt-amount" value="${usdtAmount || ''}" placeholder="USDT Amount" step="0.01"></td>
                <td><span class="quantity">0.00000000</span></td>
                <td><span class="pnl">0.00 USDT</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="sell-purchase">Sell</button>
                        <button class="delete-purchase">Delete</button>
                    </div>
                </td>
            </tr>
        `);
        
        $('#purchases').append(row);
        saveAllData();
        calculatePNL(coin);
        calculateAllPNL();
    }
    
    // Fungsi untuk menghapus pembelian
    function removePurchase(row) {
        const coin = row.data('coin');
        row.remove();
        saveAllData();
        calculatePNL(coin);
        calculateAllPNL();
    }
    
    // Fungsi untuk menghapus transaksi (tanpa menjual)
    function deletePurchase(row) {
        row.remove();
        saveAllData();
        calculateAllPNL();
    }
    
    // Fungsi untuk ekspor ke Excel
    function exportToExcel() {
        const purchases = [];
        $('.purchase-row').each(function () {
            purchases.push({
                'Coin': $(this).data('coin'),
                'Buy Price (USDT)': $(this).find('.buy-price').val(),
                'Amount (USDT)': $(this).find('.usdt-amount').val(),
                'Quantity': $(this).find('.quantity').text(),
                'PNL': $(this).find('.pnl').text(),
                'Date': new Date(parseInt($(this).data('timestamp'))).toLocaleString()
            });
        });
        
        // Tambahkan summary
        const summary = {
            'Total Investment': $('#total-all-investment').text(),
            'Current Value': $('#total-all-value').text(),
            'Total PNL': $('#total-all-pnl').text(),
            'Total ROI': $('#total-all-roi').text(),
            'Export Date': new Date().toLocaleString()
        };
        
        const wb = XLSX.utils.book_new();
        const ws1 = XLSX.utils.json_to_sheet(purchases);
        const ws2 = XLSX.utils.json_to_sheet([summary]);
        
        XLSX.utils.book_append_sheet(wb, ws1, "Transactions");
        XLSX.utils.book_append_sheet(wb, ws2, "Summary");
        
        XLSX.writeFile(wb, "Crypto_DCA_Portfolio.xlsx");
    }
    
    // Fungsi untuk impor dari Excel
    function importFromExcel(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Ambil data dari sheet pertama (Transactions)
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            // Clear existing data
            $('.purchase-row').remove();
            
            // Tambahkan data baru
            jsonData.forEach(row => {
                if (row['Coin'] && coins.includes(row['Coin'] + 'USDT')) {
                    addPurchaseRow(
                        row['Coin'],
                        row['Buy Price (USDT)'],
                        row['Amount (USDT)'],
                        new Date(row['Date'] || Date.now()).getTime()
                    );
                }
            });
            
            alert(`Berhasil mengimpor ${jsonData.length} transaksi!`);
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    // Fungsi utama untuk fetch harga
    function fetchPrices() {
        coins.forEach(coin => {
            $.ajax({
                url: `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${coin}`,
                success: function (result) {
                    if (result.code === '00000' && result.data && result.data.length > 0) {
                        coinPrices[coin] = parseFloat(result.data[0].lastPr);
                        $(`#live-price-${coin.replace('USDT', '')}`).text(result.data[0].lastPr);
                    }
                }
            });
        });
        calculateAllPNL();
    }

    // Load data saat pertama kali dibuka
    loadAllData();
    fetchPrices();
    setInterval(fetchPrices, 5000);

    // Event listeners
    $('#add-purchase').click(function () {
        const coin = $('#coin-select').val();
        addPurchaseRow(coin, '', '');
    });

    $(document).on('click', '.sell-purchase', function () {
        // removePurchase($(this).closest('.purchase-row'));
        if (confirm("Apakah Anda yakin ingin menjual transaksi ini?")) {
            removePurchase($(this).closest('.purchase-row'));
        }
    });
    
    $(document).on('click', '.delete-purchase', function () {
        if (confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
            deletePurchase($(this).closest('.purchase-row'));
        }
    });
    
    $(document).on('click', '.sell-all', function () {
        const coin = $(this).data('coin');
        $(`.purchase-row[data-coin="${coin}"]`).each(function() {
            removePurchase($(this));
        });
    });
    
    
    $('#sell-all').click(function() {
        if (confirm("Apakah Anda yakin ingin menjual SEMUA transaksi?")) {
            $('.purchase-row').each(function() {
                removePurchase($(this));
            });
        }
    });
    
    $('#export-excel').click(exportToExcel);
    
    $('#import-excel').change(function(e) {
        if (confirm("Impor data akan menggantikan semua transaksi yang ada. Lanjutkan?")) {
            importFromExcel(e);
        } else {
            $(this).val('');
        }
    });

    // Simpan data ketika ada perubahan input
    $(document).on('input', '.buy-price, .usdt-amount', function () {
        const coin = $(this).closest('.purchase-row').data('coin');
        saveAllData();
        calculatePNL(coin);
        calculateAllPNL();
    });
    
    // Fungsi untuk menghitung PNL untuk coin tertentu
    function calculatePNL(coin) {
        var totalPnL = 0;
        var totalInvestment = 0;
        var totalQuantity = 0;
        var currentValue = 0;
        
        $(`.purchase-row[data-coin="${coin}"]`).each(function () {
            var buyPrice = parseFloat($(this).find('.buy-price').val()) || 0;
            var usdtAmount = parseFloat($(this).find('.usdt-amount').val()) || 0;
            var quantity = usdtAmount / buyPrice;
            
            // Calculate fee 0.1%
            var fee = quantity * 0.001;
            quantity -= fee;
            
            var currentPrice = coinPrices[coin + 'USDT'] || 0;
            var pnl = ((currentPrice * quantity) - (buyPrice * quantity)) - (((currentPrice * quantity)) * 0.001);
            $(this).find('.quantity').text(quantity.toFixed(8));
            $(this).find('.pnl').text(pnl.toFixed(2) + " USDT");
            
            // Set color for PNL
            if (pnl >= 0) {
                $(this).find('.pnl').addClass('positive');
                $(this).find('.pnl').removeClass('negative');
            } else {
                $(this).find('.pnl').addClass('negative');
                $(this).find('.pnl').removeClass('positive');
            }
            
            totalPnL += pnl;
            totalInvestment += usdtAmount;
            totalQuantity += quantity;
            currentValue += quantity * currentPrice;
        });
        
        // Update coin summary
        if ($(`#coin-summary-${coin}`).length === 0 && totalQuantity > 0) {
            $('#coin-summaries').append(`
                <tr id="coin-summary-${coin}" data-coin="${coin}">
                    <td>${coin}</td>
                    <td><span id="total-investment-${coin}">${totalInvestment.toFixed(2)}</span> USDT</td>
                    <td><span id="total-quantity-${coin}">${totalQuantity.toFixed(8)}</span></td>
                    <td><span id="current-price-${coin}">${(coinPrices[coin + 'USDT'] || 0).toFixed(8)}</span> USDT</td>
                    <td><span id="current-value-${coin}">${currentValue.toFixed(2)}</span> USDT</td>
                    <td><span id="total-pnl-${coin}" class="${totalPnL >= 0 ? 'positive' : 'negative'}">${totalPnL.toFixed(2)}</span> USDT</td>
                    <td><span id="roi-${coin}" class="${(totalPnL/totalInvestment*100) >= 0 ? 'positive' : 'negative'}">${(totalInvestment > 0 ? (totalPnL/totalInvestment*100).toFixed(2) : 0)}%</span></td>
                    <td><button class="sell-all" data-coin="${coin}">Sell All</button></td>
                </tr>
            `);
        } else if (totalQuantity > 0) {
            $(`#total-investment-${coin}`).text(totalInvestment.toFixed(2));
            $(`#total-quantity-${coin}`).text(totalQuantity.toFixed(8));
            $(`#current-price-${coin}`).text((coinPrices[coin + 'USDT'] || 0).toFixed(8));
            $(`#current-value-${coin}`).text(currentValue.toFixed(2));
            
            const pnlElement = $(`#total-pnl-${coin}`);
            pnlElement.text(totalPnL.toFixed(2));
            pnlElement.removeClass('positive negative').addClass(totalPnL >= 0 ? 'positive' : 'negative');
            
            const roiElement = $(`#roi-${coin}`);
            const roi = totalInvestment > 0 ? (totalPnL/totalInvestment*100).toFixed(2) : 0;
            roiElement.text(roi + '%');
            roiElement.removeClass('positive negative').addClass(roi >= 0 ? 'positive' : 'negative');
        } else {
            $(`#coin-summary-${coin}`).remove();
        }
    }
    
    // Fungsi untuk menghitung semua PNL
    function calculateAllPNL() {
        coins.forEach(coin => {
            calculatePNL(coin.replace('USDT', ''));
        });
        
        // Calculate total PNL across all coins
        let totalAllInvestment = 0;
        let totalAllValue = 0;
        let totalAllPNL = 0;
        
        $('[id^="coin-summary-"]').each(function() {
            totalAllInvestment += parseFloat($(this).find('[id^="total-investment-"]').text());
            totalAllValue += parseFloat($(this).find('[id^="current-value-"]').text());
        });
        
        totalAllPNL = (totalAllValue - totalAllInvestment)*(1-0.001);
        
        $('#total-all-investment').text(totalAllInvestment.toFixed(2) + ' USDT');
        $('#total-all-value').text(totalAllValue.toFixed(2) + ' USDT');
        
        const totalAllPnlElement = $('#total-all-pnl');
        totalAllPnlElement.text(totalAllPNL.toFixed(2) + ' USDT');
        totalAllPnlElement.removeClass('positive negative').addClass(totalAllPNL >= 0 ? 'positive' : 'negative');
        
        const totalAllRoiElement = $('#total-all-roi');
        const totalRoi = totalAllInvestment > 0 ? (totalAllPNL/totalAllInvestment*100).toFixed(2) : 0;
        totalAllRoiElement.text(totalRoi + '%');
        totalAllRoiElement.removeClass('positive negative').addClass(totalRoi >= 0 ? 'positive' : 'negative');
    }
});
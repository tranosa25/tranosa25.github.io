let rawData = [];
let allSubServices = { net: new Set(), play: new Set(), cam: new Set() };

// ==========================================
// 1. NẠP DỮ LIỆU TỪ JSON & KHỞI TẠO
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    fetch('output_chinh_sach_Full.json?v=' + new Date().getTime()) 
        .then(response => {
            if (!response.ok) throw new Error("Lỗi HTTP: " + response.status);
            return response.json();
        })
        .then(data => {
            rawData = data;
            console.log("Đã nạp xong dữ liệu! Tổng số CS:", rawData.length);
            initApp(); 
        })
        .catch(err => console.error("Lỗi nạp dữ liệu:", err));
});

function initApp() {
    initFilters();
    initFlowSubServiceOptions();
}

function initFilters() {
    let serviceSet = new Set();
    let cusTypeSet = new Set();
    let cusTypeL1Set = new Set();

    rawData.forEach(p => {
        if (p.ServiceNames && Array.isArray(p.ServiceNames)) {
            p.ServiceNames.forEach(s => { if (s.trim()) serviceSet.add(s.trim()); });
        }
        if (p.CustomerTypeID) p.CustomerTypeID.split(',').forEach(t => { if (t.trim()) cusTypeSet.add(t.trim()); });
        if (p.CusTypeL1ID) p.CusTypeL1ID.split(',').forEach(t => { if (t.trim()) cusTypeL1Set.add(t.trim()); });
    });

    const populateSelect = (elementId, items, isMultiple = false) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        // Nếu là ô chọn nhiều (multiple) thì không thêm dòng "-- Tất cả --"
        el.innerHTML = isMultiple ? '' : '<option value="">-- Tất cả --</option>';
        Array.from(items).sort().forEach(item => { el.innerHTML += `<option value="${item}">${item}</option>`; });
    };

    // Gọi cờ 'true' cho f1_Service để kích hoạt chế độ chọn nhiều
    populateSelect("f1_Service", serviceSet, true);
    populateSelect("f1_CusType", cusTypeSet);
    populateSelect("f1_CusTypeL1", cusTypeL1Set);
}

// Hàm bổ trợ lấy dữ liệu selected từ thẻ select multiple
function getSelectedValues(selectElement) {
    if (!selectElement) return [];
    return Array.from(selectElement.selectedOptions).map(opt => opt.value);
}

// ==========================================
// THỰC THI TÌM THEO DỊCH VỤ (LUỒNG 1)
// ==========================================
function loadF1Policies() {
    const serviceSelect = document.getElementById('f1_Service');
    const selServices = getSelectedValues(serviceSelect);
    
    // 1. Render các dịch vụ đã chọn thành Tag (Badge) lên giao diện
    const selectedContainer = document.getElementById('f1_SelectedServices');
    if (selectedContainer) {
        selectedContainer.innerHTML = selServices.map(srv => 
            `<span class="badge" style="background: var(--fpt-orange); color: white; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 11px; display: inline-block; margin: 2px;">${srv}</span>`
        ).join('');
    }

    const cusTypeEl = document.getElementById('f1_CusType');
    const cusTypeL1El = document.getElementById('f1_CusTypeL1');
    const selCusType = cusTypeEl ? cusTypeEl.value : "";
    const selCusTypeL1 = cusTypeL1El ? cusTypeL1El.value : "";

    let filtered = rawData || [];
    
    // Lọc KHỚP TUYỆT ĐỐI theo Dịch vụ (Đảm bảo độ chính xác cao)
    if (selServices.length > 0) {
        filtered = filtered.filter(policy => {
            const policyServices = (policy.ServiceNames || []).map(s => s.trim());
            // Điều kiện 1: Số lượng dịch vụ phải BẰNG số lượng tick
            if (policyServices.length !== selServices.length) return false;
            // Điều kiện 2: Các dịch vụ tick phải khớp hoàn toàn
            return selServices.every(service => policyServices.includes(service));
        });
    }
    
    // Lọc tiếp theo Nhóm Loại Khách Hàng
    filtered = filtered.filter(p => {
        let matchCus = selCusType ? (p.CustomerTypeID && p.CustomerTypeID.includes(selCusType)) : true;
        let matchCusL1 = selCusTypeL1 ? (p.CusTypeL1ID && p.CusTypeL1ID.includes(selCusTypeL1)) : true;
        return matchCus && matchCusL1;
    });

    // Render danh sách chính sách bằng chuỗi HTML để tránh lỗi mobile
    const f1PolicyEl = document.getElementById('f1_Policy');
    if (f1PolicyEl) {
        let htmlStr = '<option value="">-- Chọn Chính Sách --</option>';
        filtered.forEach(item => {
            htmlStr += `<option value="${item.PolicyID}">[${item.PolicyCode}] ${item.PolicyName}</option>`;
        });
        f1PolicyEl.innerHTML = htmlStr;
    }
    
    const f1ProgramEl = document.getElementById('f1_Program');
    if (f1ProgramEl) {
        f1ProgramEl.innerHTML = '<option value="">-- Trống --</option>';
    }
    
    const resultSec = document.getElementById('resultSection');
    if (resultSec) resultSec.classList.remove('active');
}

function loadPrograms(polIdObj, progIdObj) {
    const pid = document.getElementById(polIdObj).value;
    const progSel = document.getElementById(progIdObj);
    
    if (!progSel) return;

    if (!pid) {
        progSel.innerHTML = '<option value="">-- Chọn Điều Kiện / Chương Trình --</option>';
        return;
    }

    const policy = rawData.find(p => p.PolicyID.toString() === pid.toString());
    
    // Tạo chuỗi HTML chuẩn để tránh lỗi không render trên trình duyệt Mobile
    let htmlOptions = '<option value="">-- Chọn Điều Kiện / Chương Trình --</option>';
    if (policy && policy.Programs) {
        policy.Programs.forEach(pr => { 
            htmlOptions += `<option value="${pr.ProgramID}">${pr.ProgramName}</option>`;
        });
    }
    progSel.innerHTML = htmlOptions;
}

// ==========================================
// FLOW SUB: TÌM THEO GÓI CƯỚC (CÓ LỌC ĐỐI TƯỢNG)
// ==========================================
function initFlowSubServiceOptions() {
    const cusTypeSet = new Set();
    const cusTypeL1Set = new Set();
    rawData.forEach(p => {
        if (p.CustomerTypeID) p.CustomerTypeID.split(',').forEach(t => { if (t.trim()) cusTypeSet.add(t.trim()); });
        if (p.CusTypeL1ID) p.CusTypeL1ID.split(',').forEach(t => { if (t.trim()) cusTypeL1Set.add(t.trim()); });
    });
    
    const populateSelect = (elementId, items) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.innerHTML = '<option value="">-- Tất cả --</option>';
        Array.from(items).sort().forEach(item => { el.innerHTML += `<option value="${item}">${item}</option>`; });
    };
    populateSelect("sub_CusType", cusTypeSet);
    populateSelect("sub_CusTypeL1", cusTypeL1Set);

    filterSubServicesBase();
}

function filterSubServicesBase() {
    const selectedCusType = document.getElementById("sub_CusType").value;
    const selectedCusTypeL1 = document.getElementById("sub_CusTypeL1").value;
    allSubServices = { net: new Set(), play: new Set(), cam: new Set() };
    
    rawData.forEach(p => {
        if (selectedCusType && (!p.CustomerTypeID || !p.CustomerTypeID.includes(selectedCusType))) return;
        if (selectedCusTypeL1 && (!p.CusTypeL1ID || !p.CusTypeL1ID.includes(selectedCusTypeL1))) return;

        if (p.Programs) {
            p.Programs.forEach(pr => {
                if (pr.Services) {
                    pr.Services.forEach(s => {
                        let name = (s.SubServiceName || s.StatementName || "").trim();
                        if (!name) return;
                        let type = s.SubServiceTypeName || "";
                        if (type.includes("Net")) allSubServices.net.add(name);
                        else if (type.includes("FPT Play")) allSubServices.play.add(name);
                        else if (type.includes("Cloud") || type.includes("Camera") || type.includes("CMR")) allSubServices.cam.add(name);
                    });
                }
            });
        }
    });

    populateMultiSelect("sub_Net", allSubServices.net);
    handleNetChange(); 
}

function populateMultiSelect(id, itemsSet) {
    const el = document.getElementById(id);
    if (!el) return;
    const currentSelected = Array.from(el.selectedOptions).map(o => o.value);
    el.innerHTML = '';
    Array.from(itemsSet).sort().forEach(item => {
        let isSelected = currentSelected.includes(item) ? 'selected' : '';
        el.innerHTML += `<option value="${item}" ${isSelected}>${item}</option>`;
    });
}

function handleNetChange() {
    const selectedNets = Array.from(document.getElementById("sub_Net").selectedOptions).map(opt => opt.value);
    const selectedCusType = document.getElementById("sub_CusType").value;
    const selectedCusTypeL1 = document.getElementById("sub_CusTypeL1").value;
    
    if (selectedNets.length === 0) {
        populateMultiSelect("sub_Play", allSubServices.play);
        populateMultiSelect("sub_Cam", allSubServices.cam);
    } else {
        let validPlays = new Set();
        let validCams = new Set();
        
        rawData.forEach(p => {
            if (selectedCusType && (!p.CustomerTypeID || !p.CustomerTypeID.includes(selectedCusType))) return;
            if (selectedCusTypeL1 && (!p.CusTypeL1ID || !p.CusTypeL1ID.includes(selectedCusTypeL1))) return;

            if (p.Programs) {
                p.Programs.forEach(pr => {
                    if (pr.Services) {
                        let serviceNames = pr.Services.map(s => (s.SubServiceName || s.StatementName || "").trim());
                        let hasMatchingNet = selectedNets.some(net => serviceNames.includes(net));
                        
                        if (hasMatchingNet) {
                            pr.Services.forEach(s => {
                                let name = (s.SubServiceName || s.StatementName || "").trim();
                                let type = s.SubServiceTypeName || "";
                                if (type.includes("FPT Play")) validPlays.add(name);
                                else if (type.includes("Cloud") || type.includes("Camera") || type.includes("CMR")) validCams.add(name);
                            });
                        }
                    }
                });
            }
        });
        populateMultiSelect("sub_Play", validPlays);
        populateMultiSelect("sub_Cam", validCams);
    }
    searchBySubServices();
}

function searchBySubServices() {
    const selectedNets = Array.from(document.getElementById("sub_Net").selectedOptions).map(o => o.value);
    const selectedPlays = Array.from(document.getElementById("sub_Play").selectedOptions).map(o => o.value);
    const selectedCams = Array.from(document.getElementById("sub_Cam").selectedOptions).map(o => o.value);
    const selectedCusType = document.getElementById("sub_CusType").value;
    const selectedCusTypeL1 = document.getElementById("sub_CusTypeL1").value;
    
    const selectedSubServices = [...selectedNets, ...selectedPlays, ...selectedCams];
    const resultsContainer = document.getElementById("sub_ResultsList");

    resultsContainer.innerHTML = '';
    
    if (selectedSubServices.length === 0) {
        document.getElementById("sub_ResultWrap").style.display = 'none';
        return;
    }

    document.getElementById("sub_ResultWrap").style.display = 'block';
    let matchCount = 0;

    rawData.forEach(p => {
        if (selectedCusType && (!p.CustomerTypeID || !p.CustomerTypeID.includes(selectedCusType))) return;
        if (selectedCusTypeL1 && (!p.CusTypeL1ID || !p.CusTypeL1ID.includes(selectedCusTypeL1))) return;

        if (p.Programs) {
            p.Programs.forEach(pr => {
                if (pr.Services && pr.Services.length > 0) {
                    let serviceNames = pr.Services.map(s => (s.SubServiceName || s.StatementName || "").trim());
                    let containsAll = selectedSubServices.every(sub => serviceNames.includes(sub));
                    
                    if (containsAll) {
                        matchCount++;
                        resultsContainer.innerHTML += `
                            <div class="list-item" onclick="selectSubResult('${p.PolicyID}', '${pr.ProgramID}')">
                                <strong>[${p.PolicyCode}] ${p.PolicyName}</strong><br>
                                <span style="color:var(--fpt-orange);">Chương trình: ${pr.ProgramName}</span><br>
                                <small>Gói cước: <b style="color:var(--fpt-blue)">${selectedSubServices.join(" + ")}</b></small>
                            </div>
                        `;
                    }
                }
            });
        }
    });

    if (matchCount === 0) {
        resultsContainer.innerHTML = '<div class="empty">Không tìm thấy chính sách nào thỏa mãn yêu cầu.</div>';
    }
}

function selectSubResult(pid, progId) {
    let hiddenPol = document.getElementById("hidden_sub_Policy");
    if (!hiddenPol) {
        let input = document.createElement("input");
        input.type = "hidden";
        input.id = "hidden_sub_Policy";
        document.body.appendChild(input);
        hiddenPol = document.getElementById("hidden_sub_Policy");
    }
    hiddenPol.value = pid;

    let hiddenProg = document.getElementById("hidden_sub_Program");
    if (!hiddenProg) {
        let input = document.createElement("select");
        input.id = "hidden_sub_Program";
        input.style.display = 'none';
        document.body.appendChild(input);
        hiddenProg = document.getElementById("hidden_sub_Program");
    }
    hiddenProg.innerHTML = `<option value="${progId}" selected>${progId}</option>`;
    showResults('hidden_sub_Policy', 'hidden_sub_Program');
}

// ==========================================
// CÁC HÀM UI & HIỂN THỊ
// ==========================================
function switchFlow(flowId, btn) {
    document.querySelectorAll('.flow-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.flow-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(flowId).classList.add('active');
    btn.classList.add('active');
    document.getElementById("resultSection").classList.remove('active');
}

function switchDataTab(tabId, btn) {
    document.querySelectorAll('.d-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.d-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function toggleDetails() {
    const box = document.getElementById('extraInfo');
    const btn = document.getElementById('btnDetails');
    if (box.classList.contains('active')) {
        box.classList.remove('active');
        btn.textContent = "Chi tiết ▼";
    } else {
        box.classList.add('active');
        btn.textContent = "Thu gọn ▲";
    }
}

function formatMoney(n) { return new Intl.NumberFormat('vi-VN').format(n) + ' đ'; }

function loadF2Policies() {
    const keyword = document.getElementById("f2_Code").value.toLowerCase();
    const polSelect = document.getElementById("f2_Policy");
    document.getElementById("f2_Program").innerHTML = '<option value="">-- Trống --</option>';
    
    if (keyword.length < 2) return;
    polSelect.innerHTML = '<option value="">-- Gõ để tìm kiếm --</option>';
    
    let matched = rawData.filter(p => (p.PolicyCode || "").toLowerCase().includes(keyword) || (p.PolicyName || "").toLowerCase().includes(keyword));
    if (matched.length > 0) {
        polSelect.innerHTML = '<option value="">-- Chọn Chính Sách Tương Ứng --</option>';
        matched.forEach(p => polSelect.innerHTML += `<option value="${p.PolicyID}">${p.PolicyCode} - ${p.PolicyName}</option>`);
    } else {
        polSelect.innerHTML = '<option value="">-- Không tìm thấy --</option>';
    }
}

function searchByPrice() {
    const val = parseFloat(document.getElementById("f3_Price").value);
    const listWrap = document.getElementById("f3_ListWrap");
    const listDiv = document.getElementById("f3_List");
    const progWrap = document.getElementById("f3_ProgWrap");
    const progSel = document.getElementById("f3_Program");
    
    listDiv.innerHTML = '';
    progWrap.style.display = 'none';

    if (!val || val <= 0) {
        listWrap.style.display = 'none';
        return;
    }

    listWrap.style.display = 'block';
    let foundMatches = [];

    rawData.forEach(p => {
        if (p.Programs) {
            p.Programs.forEach(pr => {
                if (pr.Services) {
                    pr.Services.forEach(s => {
                        if (s.Price && Math.abs(parseFloat(s.Price) - val) < 1000) {
                            foundMatches.push({ policy: p, program: pr, service: s });
                        }
                    });
                }
            });
        }
    });

    if (foundMatches.length > 0) {
        foundMatches.forEach(m => {
            listDiv.innerHTML += `
                <div class="list-item" onclick='selectPriceResult("${m.policy.PolicyID}", "${m.program.ProgramID}")'>
                    <strong>[${m.policy.PolicyCode}] ${m.policy.PolicyName}</strong><br>
                    <span style="color:var(--fpt-orange)">Chương trình: ${m.program.ProgramName}</span><br>
                    <small>Gói: ${m.service.SubServiceName} - Giá: ${formatMoney(m.service.Price)}</small>
                </div>
            `;
        });
    } else {
        listDiv.innerHTML = '<div class="empty">Không tìm thấy mức giá xấp xỉ</div>';
    }
}

function selectPriceResult(pid, progId) {
    document.getElementById("hidden_f3_Policy").value = pid;
    const p = rawData.find(x => x.PolicyID == pid);
    const progSel = document.getElementById("f3_Program");
    progSel.innerHTML = '';
    if (p && p.Programs) {
        p.Programs.forEach(pr => {
            let selected = pr.ProgramID == progId ? 'selected' : '';
            progSel.innerHTML += `<option value="${pr.ProgramID}" ${selected}>${pr.ProgramName}</option>`;
        });
    }
    document.getElementById("f3_ProgWrap").style.display = 'block';
    showResults('hidden_f3_Policy', 'f3_Program');
}

function showResults(polIdObj, progIdObj) {
    const pid = document.getElementById(polIdObj).value;
    const progId = document.getElementById(progIdObj).value;
    if (!pid || !progId) return;

    const p = rawData.find(x => x.PolicyID.toString() === pid.toString());
    if(!p) return;
    const pr = p.Programs.find(x => x.ProgramID.toString() === progId.toString());
    if(!pr) return;

    document.getElementById('p_code').textContent = p.PolicyCode;
    document.getElementById('p_name').textContent = p.PolicyName;
    document.getElementById('p_date').textContent = `${(p.FromDate||"").split(' ')[0]} đến ${(p.ToDate||"").split(' ')[0]}`;
    document.getElementById('p_prog').textContent = pr.ProgramName;
    
    document.getElementById('p_customerTypeID').textContent = p.CustomerTypeID || "Tất cả";
    document.getElementById('p_saleChannel').textContent = p.SaleChannel || "Tất cả";
    document.getElementById('p_cusTypeL1ID').textContent = p.CusTypeL1ID || "Tất cả";

    // 1. Cước Dịch Vụ
    const tbSrv = document.getElementById('tbodySrv'); tbSrv.innerHTML = '';
    if (pr.Services && pr.Services.length > 0) {
        let groupedServices = {};
        pr.Services.forEach(s => {
            let key = s.NamePriceStatement ? s.NamePriceStatement.trim() : `Don_le_${s.ID}`;
            if (!groupedServices[key]) groupedServices[key] = [];
            groupedServices[key].push(s);
        });

        let groupIndex = 0;
        for (let key in groupedServices) {
            let group = groupedServices[key];
            let totalComboPrice = group.reduce((sum, s) => sum + (s.Price || 0), 0);
            let bgColor = groupIndex % 2 === 0 ? "#ffffff" : "#f4f7f9"; 
            groupIndex++;
            
            group.forEach((s, index) => {
                let rowHtml = `<tr style="background-color: ${bgColor};">
                    <td style="padding: 8px 10px;">
                        <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 4px;">
                            <strong style="color: var(--fpt-blue); font-size: 13px; margin: 0;">${s.SubServiceName || ""}</strong>
                            <span class="badge" style="margin: 0;">${s.SubServiceTypeName || ""}</span>
                        </div>
                        <div style="font-size: 11px; color: #475569; line-height: 1.4;">
                            Diễn giải: <i>${s.StatementName || ""}</i> <span style="margin: 0 5px; color: #94a3b8;">|</span> Cước lẻ: <b style="color:var(--fpt-orange)">${formatMoney(s.Price || 0)}</b>
                        </div>
                    </td>
                    <td class="col-center" style="vertical-align: middle; padding: 8px;">${s.PrepaidMonth}T</td>
                    <td class="col-right" style="vertical-align: middle; padding: 8px;">${formatMoney(s.ConnectionFee || 0)}</td>`;
                
                if (index === 0) {
                    rowHtml += `
                    <td class="col-center col-combo" rowspan="${group.length}" style="vertical-align: middle; font-size: 14px; background-color: ${bgColor};">
                        ${formatMoney(totalComboPrice)}
                    </td>
                    <td rowspan="${group.length}" style="vertical-align: middle; font-size: 12px; color: var(--fpt-blue); line-height: 1.5; background-color: ${bgColor}; border-left: 1px solid var(--border);">
                        ${(s.NamePriceStatement || "").replace(/\n/g, "<br>")}
                    </td>`;
                }
                
                rowHtml += `</tr>`;
                tbSrv.innerHTML += rowHtml;
            });
        }
    } else { tbSrv.innerHTML = `<tr><td colspan="5" class="empty">Chưa có thông tin cước</td></tr>`; }

    // 2. Thiết bị
    const tbDev = document.getElementById('tbodyDev'); tbDev.innerHTML = '';
    if (pr.Devices && pr.Devices.length > 0) {
        pr.Devices.forEach(d => {
            tbDev.innerHTML += `<tr>
                <td><strong>${d.DeviceName}</strong></td>
                <td><span class="badge">${d.SubServiceTypeName}</span></td>
                <td class="col-center">${d.DeviceStatusName || ""}</td>
                <td class="col-center">${d.TransactionTypeName || d.IsDeployName || ""}</td>
                <td>${d.StatementName || ""}</td>
                <td class="col-right col-price">${formatMoney(d.Price || 0)}</td>
            </tr>`;
        });
    } else { tbDev.innerHTML = `<tr><td colspan="6" class="empty">Chưa có thông tin thiết bị</td></tr>`; }

    // 3. Phí Triển Khai
    const tbDep = document.getElementById('tbodyDep'); tbDep.innerHTML = '';
    if (pr.Deployments && pr.Deployments.length > 0) {
        pr.Deployments.forEach(dp => {
            tbDep.innerHTML += `<tr>
                <td><strong>${dp.DeploymentName || dp.Name || "Chi phí triển khai"}</strong><br><span class="badge">${dp.SubServiceTypeName || 'Khác'}</span></td>
                <td class="col-center">${dp.Unit || "Lần"}</td>
                <td class="col-center">${dp.Quantity || 1}</td>
                <td class="col-right col-price">${formatMoney(dp.Price || 0)}</td>
                <td>${dp.Description || dp.StatementName || "-"}</td>
            </tr>`;
        });
    } else { tbDep.innerHTML = `<tr><td colspan="5" class="empty">Không phát sinh phí triển khai</td></tr>`; }

    document.getElementById("resultSection").classList.add('active');
}

function openGeminiChat() {
    window.open("https://share.gemini.google/oZxl24r6TXcA", "GeminiChat", "width=450,height=650,left=100,top=100,resizable=yes,scrollbars=yes");
}

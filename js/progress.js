(function () {
    "use strict";

    const PROGRESS_KEY = "crmMemberProgress";
    const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
    const PHOTO_MAX_PX = 900;
    const WORKOUT_EXERCISE_MAX = 50;
    const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const MEASUREMENT_FIELDS = [
        { key: "chest", id: "progressMeasureChest", label: "Chest", min: 1, max: 300 },
        { key: "waist", id: "progressMeasureWaist", label: "Waist", min: 1, max: 300 },
        { key: "hips", id: "progressMeasureHips", label: "Hips", min: 1, max: 300 },
        { key: "shoulders", id: "progressMeasureShoulders", label: "Shoulders", min: 1, max: 300 },
        { key: "armLeft", id: "progressMeasureArmLeft", label: "Left arm", min: 1, max: 150 },
        { key: "armRight", id: "progressMeasureArmRight", label: "Right arm", min: 1, max: 150 },
        { key: "thighLeft", id: "progressMeasureThighLeft", label: "Left thigh", min: 1, max: 150 },
        { key: "thighRight", id: "progressMeasureThighRight", label: "Right thigh", min: 1, max: 150 },
        { key: "calfLeft", id: "progressMeasureCalfLeft", label: "Left calf", min: 1, max: 150 },
        { key: "calfRight", id: "progressMeasureCalfRight", label: "Right calf", min: 1, max: 150 },
        { key: "neck", id: "progressMeasureNeck", label: "Neck", min: 1, max: 100 }
    ];
    const MEASUREMENT_SECTIONS = [
        { label: "Torso & Neck", keys: ["chest", "waist", "hips", "shoulders", "neck"] },
        { label: "Arms", keys: ["armLeft", "armRight"] },
        { label: "Thighs", keys: ["thighLeft", "thighRight"] },
        { label: "Calves", keys: ["calfLeft", "calfRight"] }
    ];

    function byId(id) {
        return document.getElementById(id);
    }

    function escapeValue(value) {
        if (typeof escapeHtml === "function") return escapeHtml(value);
        return String(value || "").replace(/[&<>"']/g, function (ch) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
        });
    }

    function dateLabel(value) {
        if (!value) return "—";
        if (typeof formatDateLogged === "function") return formatDateLogged(value);
        return String(value);
    }

    function shortDate(value) {
        const raw = String(value || "").trim();
        const date = new Date(raw + "T00:00:00");
        if (isNaN(date.getTime())) return raw || "—";
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }

    function todayValue() {
        if (typeof todayISO === "function") return todayISO();
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        return now.getFullYear() + "-" + month + "-" + day;
    }

    function dateWithYearOffset(years) {
        const parts = todayValue().split("-");
        const year = Number(parts[0]) + years;
        const month = Number(parts[1]);
        const day = Number(parts[2]);
        const lastDay = new Date(year, month, 0).getDate();
        return year + "-" + String(month).padStart(2, "0") + "-" + String(Math.min(day, lastDay)).padStart(2, "0");
    }

    function isDateInProgressRange(value) {
        if (!value) return false;
        return value >= todayValue() && value <= dateWithYearOffset(10);
    }

    function numberOrNull(value) {
        if (value === null || value === undefined || value === "") return null;
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
    }

    function positiveNumber(value, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < min || number > max) return null;
        return Math.round(number * 10) / 10;
    }

    function parseOneDecimal(value) {
        const raw = String(value === null || value === undefined ? "" : value).trim();
        if (!raw) return { status: "empty", value: null };
        if (!/^\d+(\.\d)?$/.test(raw)) return { status: "format", value: null };
        return { status: "ok", value: Number(raw) };
    }

    function guardNumericInput(input) {
        if (!input) return;
        input.addEventListener("keydown", function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === "e" || event.key === "E" || event.key === "+" || event.key === "-") {
                event.preventDefault();
            }
        });
        input.addEventListener("paste", function (event) {
            const clipboard = event.clipboardData || window.clipboardData;
            const text = clipboard ? clipboard.getData("text") : "";
            if (text && !/^\d+(\.\d)?$/.test(text.trim())) event.preventDefault();
        });
        input.addEventListener("input", function () {
            const value = input.value;
            if (!value || value.indexOf(".") === -1) return;
            const parts = value.split(".");
            if (parts.length > 2 || (parts[1] && parts[1].length > 1)) {
                input.value = parts[0] + "." + (parts[1] || "").slice(0, 1);
            }
        });
    }

    function guardWholeNumberInput(input) {
        if (!input) return;
        input.addEventListener("keydown", function (event) {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (["e", "E", "+", "-", ".", ","].indexOf(event.key) > -1) {
                event.preventDefault();
            }
        });
        input.addEventListener("paste", function (event) {
            const clipboard = event.clipboardData || window.clipboardData;
            const text = clipboard ? clipboard.getData("text") : "";
            if (text && !/^\d+$/.test(text.trim())) event.preventDefault();
        });
    }

    function newId(prefix) {
        return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function isPhotoData(value) {
        return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(String(value || ""));
    }

    function emptyRecord() {
        return { goal: null, weights: [], measurements: [], workouts: [], photos: [] };
    }

    function normalizeRecord(raw) {
        const record = emptyRecord();
        if (!raw || typeof raw !== "object") return record;

        if (raw.goal && typeof raw.goal === "object" && raw.goal.type) {
            record.goal = {
                type: String(raw.goal.type),
                customType: String(raw.goal.customType || ""),
                targetWeight: numberOrNull(raw.goal.targetWeight),
                targetDate: String(raw.goal.targetDate || ""),
                notes: String(raw.goal.notes || ""),
                updatedAt: String(raw.goal.updatedAt || "")
            };
        }

        record.weights = asArray(raw.weights).map(function (entry, index) {
            if (!entry || !entry.date) return null;
            const weight = numberOrNull(entry.weight);
            if (weight === null) return null;
            return {
                id: String(entry.id || "weight-" + index),
                date: String(entry.date),
                weight: weight,
                at: String(entry.at || "")
            };
        }).filter(Boolean);

        record.measurements = asArray(raw.measurements).map(function (entry, index) {
            if (!entry || !entry.date) return null;
            const measurement = {
                id: String(entry.id || "measure-" + index),
                date: String(entry.date),
                at: String(entry.at || "")
            };
            let hasValue = false;
            MEASUREMENT_FIELDS.forEach(function (field) {
                const value = numberOrNull(entry[field.key]);
                measurement[field.key] = value;
                if (value !== null) hasValue = true;
            });
            return hasValue ? measurement : null;
        }).filter(Boolean);

        record.workouts = asArray(raw.workouts).map(function (entry, index) {
            if (!entry || !entry.exercise) return null;

            let repsMin = numberOrNull(entry.repsMin);
            let repsMax = numberOrNull(entry.repsMax);
            if (repsMin === null || repsMax === null) {
                const legacy = String(entry.reps || "").match(/(\d+)\s*[-–]\s*(\d+)/);
                if (legacy) {
                    repsMin = Number(legacy[1]);
                    repsMax = Number(legacy[2]);
                } else {
                    const single = numberOrNull(entry.reps);
                    if (single !== null) {
                        repsMin = single;
                        repsMax = single;
                    }
                }
            }

            return {
                id: String(entry.id || "workout-" + index),
                day: WEEKDAYS.indexOf(entry.day) > -1 ? entry.day : WEEKDAYS[0],
                exercise: String(entry.exercise),
                sets: numberOrNull(entry.sets),
                repsMin: repsMin,
                repsMax: repsMax,
                at: String(entry.at || "")
            };
        }).filter(Boolean);

        record.photos = asArray(raw.photos).map(function (entry, index) {
            if (!entry || !entry.date || !isPhotoData(entry.dataUrl)) return null;
            return {
                id: String(entry.id || "photo-" + index),
                date: String(entry.date),
                dataUrl: String(entry.dataUrl),
                at: String(entry.at || "")
            };
        }).filter(Boolean);

        return record;
    }

    function readStore() {
        try {
            const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function loadRecord(username) {
        return normalizeRecord(readStore()[username]);
    }

    function saveRecord(username, record) {
        const store = readStore();
        store[username] = record;
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
    }

    function sortByDateAsc(a, b) {
        return String(a.date).localeCompare(String(b.date)) || String(a.at).localeCompare(String(b.at));
    }

    function sortByDateDesc(a, b) {
        return String(b.date).localeCompare(String(a.date)) || String(b.at).localeCompare(String(a.at));
    }

    function formatWeight(value) {
        const number = Number(value);
        return (Number.isFinite(number) ? number.toFixed(1).replace(/\.0$/, "") : value) + " kg";
    }

    function resizePhotoFile(file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onerror = function () { reject(new Error("read")); };
            reader.onload = function () {
                const image = new Image();
                image.onerror = function () { reject(new Error("decode")); };
                image.onload = function () {
                    const scale = Math.min(1, PHOTO_MAX_PX / Math.max(image.width, image.height));
                    const width = Math.max(1, Math.round(image.width * scale));
                    const height = Math.max(1, Math.round(image.height * scale));
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;
                    const context = canvas.getContext("2d");
                    if (!context) {
                        reject(new Error("canvas"));
                        return;
                    }
                    context.fillStyle = "#ffffff";
                    context.fillRect(0, 0, width, height);
                    context.drawImage(image, 0, 0, width, height);
                    try {
                        resolve(canvas.toDataURL("image/jpeg", 0.82));
                    } catch (e) {
                        reject(e);
                    }
                };
                image.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (!byId("progressSection")) return;

        const username = sessionStorage.getItem("crmCurrentUser");
        if (!username) return;

        let customers = [];
        try {
            customers = JSON.parse(localStorage.getItem("crmCustomers") || "[]");
        } catch (e) {
            customers = [];
        }
        const member = customers.find(function (entry) { return entry.username === username; });
        if (!member) return;
        if (typeof memberIsArchived === "function" && memberIsArchived(member)) return;

        let record = loadRecord(username);

        function setMessage(id, text, isError) {
            const element = byId(id);
            if (!element) return;
            element.className = isError ? "error-msg" : "success-msg";
            element.textContent = text;
        }

        function persist() {
            saveRecord(username, record);
        }

        function renderGoal() {
            const summary = byId("progressGoalSummary");
            const clearButton = byId("progressGoalClear");
            if (!summary || !clearButton) return;

            if (!record.goal) {
                summary.hidden = true;
                summary.innerHTML = "";
                clearButton.hidden = true;
                if (byId("progressGoalType")) byId("progressGoalType").value = "";
                if (byId("progressGoalCustomGroup")) byId("progressGoalCustomGroup").hidden = true;
                if (byId("progressGoalCustom")) byId("progressGoalCustom").value = "";
                if (byId("progressGoalTargetWeight")) byId("progressGoalTargetWeight").value = "";
                if (byId("progressGoalTargetDate")) byId("progressGoalTargetDate").value = "";
                if (byId("progressGoalNotes")) byId("progressGoalNotes").value = "";
                return;
            }

            const goal = record.goal;
            const isOtherGoal = goal.type === "Other";
            if (byId("progressGoalType")) byId("progressGoalType").value = goal.type;
            if (byId("progressGoalCustomGroup")) byId("progressGoalCustomGroup").hidden = !isOtherGoal;
            if (byId("progressGoalCustom")) byId("progressGoalCustom").value = isOtherGoal ? (goal.customType || "") : "";
            if (byId("progressGoalTargetWeight")) byId("progressGoalTargetWeight").value = goal.targetWeight === null ? "" : goal.targetWeight;
            if (byId("progressGoalTargetDate")) byId("progressGoalTargetDate").value = goal.targetDate || "";
            if (byId("progressGoalNotes")) byId("progressGoalNotes").value = goal.notes || "";

            summary.innerHTML = [
                '<h4>Current goal</h4>',
                '<div class="profile-grid progress-goal-grid">',
                '<div class="profile-item"><label>Goal</label><span>', escapeValue(goal.type === "Other" && goal.customType ? goal.customType : goal.type), '</span></div>',
                '<div class="profile-item"><label>Target weight</label><span>', goal.targetWeight === null ? "—" : escapeValue(formatWeight(goal.targetWeight)), '</span></div>',
                '<div class="profile-item"><label>Target date</label><span>', escapeValue(dateLabel(goal.targetDate)), '</span></div>',
                '<div class="profile-item"><label>Notes</label><span>', escapeValue(goal.notes || "—"), '</span></div>',
                '</div>'
            ].join("");
            summary.hidden = false;
            clearButton.hidden = false;
        }

        function renderWeightChart(weights) {
            const container = byId("progressWeightChart");
            if (!container) return;

            if (!weights.length) {
                container.innerHTML = '<p class="card-meta">No weight entries yet. Log your first weight above to start the chart.</p>';
                return;
            }

            const sorted = weights.slice().sort(sortByDateAsc).slice(-60);
            const values = sorted.map(function (entry) { return entry.weight; });
            let min = Math.min.apply(null, values);
            let max = Math.max.apply(null, values);
            if (min === max) {
                min -= 1;
                max += 1;
            } else {
                const padding = Math.max((max - min) * 0.15, 0.5);
                min -= padding;
                max += padding;
            }

            const width = 640;
            const height = 240;
            const left = 48;
            const right = 18;
            const top = 18;
            const bottom = 34;
            const plotWidth = width - left - right;
            const plotHeight = height - top - bottom;

            function xFor(index) {
                return sorted.length === 1 ? left + plotWidth / 2 : left + (index / (sorted.length - 1)) * plotWidth;
            }

            function yFor(value) {
                return top + plotHeight - ((value - min) / (max - min)) * plotHeight;
            }

            const grid = [];
            const ticks = 4;
            for (let index = 0; index <= ticks; index += 1) {
                const y = top + (plotHeight * index) / ticks;
                const value = max - ((max - min) * index) / ticks;
                grid.push('<line class="progress-grid-line" x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (width - right) + '" y2="' + y.toFixed(1) + '"></line>');
                grid.push('<text class="progress-tick" x="' + (left - 8) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + value.toFixed(1) + '</text>');
            }

            const points = sorted.map(function (entry, index) {
                return [xFor(index), yFor(entry.weight)];
            });
            const linePoints = points.map(function (point) {
                return point[0].toFixed(1) + "," + point[1].toFixed(1);
            }).join(" ");

            let area = "";
            if (points.length > 1) {
                const baseline = (top + plotHeight).toFixed(1);
                area = '<polygon class="progress-area" points="' + left + "," + baseline + " " + linePoints + " " + points[points.length - 1][0].toFixed(1) + "," + baseline + '"></polygon>';
            }

            const step = Math.max(1, Math.ceil(sorted.length / 5));
            const xLabels = sorted.map(function (entry, index) {
                if (index !== 0 && index !== sorted.length - 1 && index % step !== 0) return "";
                return '<text class="progress-tick" x="' + xFor(index).toFixed(1) + '" y="' + (height - 10) + '" text-anchor="middle">' + escapeValue(shortDate(entry.date)) + '</text>';
            }).join("");

            const circles = sorted.map(function (entry, index) {
                const point = points[index];
                return '<circle class="progress-point" cx="' + point[0].toFixed(1) + '" cy="' + point[1].toFixed(1) + '" r="4"><title>' + escapeValue(shortDate(entry.date)) + ": " + escapeValue(entry.weight) + ' kg</title></circle>';
            }).join("");

            container.innerHTML = '<svg viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Weight history chart">' +
                grid.join("") + area +
                '<polyline class="progress-line" points="' + linePoints + '"></polyline>' +
                circles + xLabels + '</svg>';
        }

        function renderWeightHistory() {
            const container = byId("progressWeightHistory");
            if (!container) return;

            const weights = record.weights.slice().sort(sortByDateDesc);
            if (!weights.length) {
                container.innerHTML = "";
                return;
            }

            container.innerHTML = '<h4>Weight history</h4>' + weights.map(function (entry) {
                return '<div class="progress-log-row">' +
                    '<div class="progress-log-main"><strong>' + escapeValue(formatWeight(entry.weight)) + '</strong><span>' + escapeValue(dateLabel(entry.date)) + '</span></div>' +
                    '<button type="button" class="btn-delete" data-remove-weight="' + escapeValue(entry.id) + '">Remove</button>' +
                    '</div>';
            }).join("");
        }

        function renderWeight() {
            const weights = record.weights.slice().sort(sortByDateAsc);
            const current = byId("progressCurrentWeight");
            if (current) {
                if (weights.length) {
                    current.textContent = "Current: " + formatWeight(weights[weights.length - 1].weight);
                    current.hidden = false;
                } else {
                    current.textContent = "";
                    current.hidden = true;
                }
            }
            renderWeightChart(weights);
            renderWeightHistory();
        }

        function renderMeasurements() {
            const container = byId("progressMeasureHistory");
            if (!container) return;

            const measurements = record.measurements.slice().sort(sortByDateDesc);
            if (!measurements.length) {
                container.innerHTML = "";
                return;
            }

            container.innerHTML = '<h4>Measurement history</h4>' + measurements.map(function (entry) {
                const values = MEASUREMENT_SECTIONS.map(function (section) {
                    const items = MEASUREMENT_FIELDS.filter(function (field) {
                        return section.keys.indexOf(field.key) > -1;
                    }).map(function (field) {
                        const value = entry[field.key];
                        if (value === null || value === undefined) return "";
                        return '<span>' + escapeValue(field.label) + ": <b>" + escapeValue(value) + ' cm</b></span>';
                    }).filter(Boolean);

                    if (!items.length) return "";
                    return '<div class="progress-log-section">' +
                        '<h5>' + escapeValue(section.label) + '</h5>' +
                        '<div class="progress-log-values">' + items.join("") + '</div>' +
                        '</div>';
                }).join("");

                return '<div class="progress-log-row">' +
                    '<div class="progress-log-main"><strong>' + escapeValue(dateLabel(entry.date)) + '</strong>' + values + '</div>' +
                    '<button type="button" class="btn-delete" data-remove-measurement="' + escapeValue(entry.id) + '">Remove</button>' +
                    '</div>';
            }).join("");
        }

        function renderWorkouts() {
            const container = byId("progressWorkoutPlan");
            if (!container) return;

            if (!record.workouts.length) {
                container.innerHTML = '<p class="card-meta">No exercises in your plan yet. Add one above to build your schedule.</p>';
                return;
            }

            container.innerHTML = WEEKDAYS.map(function (day) {
                const exercises = record.workouts.filter(function (entry) { return entry.day === day; });
                if (!exercises.length) return "";
                return '<div class="progress-plan-day">' +
                    '<div class="progress-plan-day-head"><strong>' + escapeValue(day) + '</strong><span>' + exercises.length + ' exercise' + (exercises.length === 1 ? "" : "s") + '</span></div>' +
                    '<ul class="progress-plan-list">' + exercises.map(function (entry) {
                        const reps = entry.repsMin === null || entry.repsMax === null
                            ? "—"
                            : (entry.repsMin === entry.repsMax ? String(entry.repsMin) : entry.repsMin + "–" + entry.repsMax);
                        return '<li>' +
                            '<div class="progress-plan-item"><strong>' + escapeValue(entry.exercise) + '</strong><span>' +
                            escapeValue((entry.sets === null ? "—" : entry.sets) + " sets") + ' &times; ' + escapeValue(reps) + ' reps</span></div>' +
                            '<button type="button" class="btn-delete" data-remove-workout="' + escapeValue(entry.id) + '">Remove</button>' +
                            '</li>';
                    }).join("") + '</ul></div>';
            }).join("");
        }

        function renderPhotos() {
            const gallery = byId("progressPhotoGallery");
            if (!gallery) return;

            const photos = record.photos.slice().sort(sortByDateDesc);
            if (!photos.length) {
                gallery.innerHTML = '<p class="card-meta">No progress photos yet. Upload your first photo to start comparing.</p>';
                return;
            }

            gallery.innerHTML = photos.map(function (photo) {
                return '<figure class="progress-photo-card">' +
                    '<button type="button" class="progress-photo-open" data-photo-id="' + escapeValue(photo.id) + '" aria-label="View progress photo from ' + escapeValue(dateLabel(photo.date)) + '">' +
                    '<img src="' + photo.dataUrl + '" alt="Progress photo from ' + escapeValue(dateLabel(photo.date)) + '" loading="lazy">' +
                    '</button>' +
                    '<figcaption><span>' + escapeValue(dateLabel(photo.date)) + '</span>' +
                    '<button type="button" class="btn-delete" data-remove-photo="' + escapeValue(photo.id) + '">Remove</button></figcaption>' +
                    '</figure>';
            }).join("");
        }

        function renderAll() {
            renderGoal();
            renderWeight();
            renderMeasurements();
            renderWorkouts();
            renderPhotos();
        }

        const progressDateMin = todayValue();
        const progressDateMax = dateWithYearOffset(10);
        const goalTargetDate = byId("progressGoalTargetDate");
        if (goalTargetDate) {
            goalTargetDate.min = progressDateMin;
            goalTargetDate.max = progressDateMax;
        }

        [byId("progressGoalTargetWeight"), byId("progressWeightValue")]
            .concat(MEASUREMENT_FIELDS.map(function (field) { return byId(field.id); }))
            .forEach(guardNumericInput);

        const workoutExerciseInput = byId("progressWorkoutExercise");
        if (workoutExerciseInput) {
            const sanitizeExercise = function () {
                if (typeof sanitizePersonNameInput === "function") {
                    sanitizePersonNameInput(workoutExerciseInput, WORKOUT_EXERCISE_MAX);
                }
            };
            workoutExerciseInput.addEventListener("input", sanitizeExercise);
            workoutExerciseInput.addEventListener("blur", sanitizeExercise);
        }

        [byId("progressWorkoutSets"), byId("progressWorkoutRepsMin"), byId("progressWorkoutRepsMax")]
            .forEach(guardWholeNumberInput);

        const progressPanelSelect = byId("progressPanelSelect");
        const progressPanels = document.querySelectorAll("[data-progress-panel]");
        if (progressPanelSelect && progressPanels.length) {
            const showProgressPanel = function (name) {
                progressPanels.forEach(function (panel) {
                    panel.hidden = panel.getAttribute("data-progress-panel") !== name;
                });
            };
            progressPanelSelect.addEventListener("change", function () {
                showProgressPanel(progressPanelSelect.value);
            });
            showProgressPanel(progressPanelSelect.value);
        }

        const goalTypeSelect = byId("progressGoalType");
        const goalCustomGroup = byId("progressGoalCustomGroup");
        const goalCustomInput = byId("progressGoalCustom");

        function syncGoalCustomField() {
            const isOther = goalTypeSelect && goalTypeSelect.value === "Other";
            if (goalCustomGroup) goalCustomGroup.hidden = !isOther;
            if (!isOther && goalCustomInput) goalCustomInput.value = "";
        }

        if (goalTypeSelect) goalTypeSelect.addEventListener("change", syncGoalCustomField);

        const goalForm = byId("progressGoalForm");
        if (goalForm) {
            goalForm.addEventListener("submit", function (event) {
                event.preventDefault();
                const type = byId("progressGoalType") ? byId("progressGoalType").value : "";
                const customType = byId("progressGoalCustom") ? byId("progressGoalCustom").value.trim() : "";
                const targetWeightRaw = byId("progressGoalTargetWeight") ? byId("progressGoalTargetWeight").value.trim() : "";
                const targetDate = byId("progressGoalTargetDate") ? byId("progressGoalTargetDate").value : "";
                const notes = byId("progressGoalNotes") ? byId("progressGoalNotes").value.trim() : "";
                const customMax = byId("progressGoalCustom") ? Number(byId("progressGoalCustom").maxLength) : 60;

                if (!type) {
                    setMessage("progressGoalMsg", "Please choose a fitness goal.", true);
                    return;
                }

                if (type === "Other") {
                    if (!customType) {
                        setMessage("progressGoalMsg", "Please enter your custom goal.", true);
                        return;
                    }
                    if (customType.length > customMax) {
                        setMessage("progressGoalMsg", "Custom goal must be " + customMax + " characters or fewer.", true);
                        return;
                    }
                }

                if (!targetWeightRaw) {
                    setMessage("progressGoalMsg", "Please enter your target weight.", true);
                    return;
                }

                if (!/^\d+(\.\d)?$/.test(targetWeightRaw)) {
                    setMessage("progressGoalMsg", "Target weight must be a number with up to one decimal place.", true);
                    return;
                }

                const targetWeight = positiveNumber(targetWeightRaw, 1, 500);
                if (targetWeight === null) {
                    setMessage("progressGoalMsg", "Target weight must be between 1 and 500 kg.", true);
                    return;
                }

                if (!targetDate) {
                    setMessage("progressGoalMsg", "Please choose a target date.", true);
                    return;
                }

                if (!isDateInProgressRange(targetDate)) {
                    setMessage("progressGoalMsg", "Target date must be between today and 10 years from now.", true);
                    return;
                }

                record.goal = {
                    type: type,
                    customType: type === "Other" ? customType : "",
                    targetWeight: targetWeight,
                    targetDate: targetDate,
                    notes: notes,
                    updatedAt: new Date().toISOString()
                };
                persist();
                renderGoal();
                setMessage("progressGoalMsg", "Your fitness goal has been saved.", false);
            });
        }

        const goalClear = byId("progressGoalClear");
        if (goalClear) {
            goalClear.addEventListener("click", function () {
                if (!record.goal) return;
                if (!confirm("Clear your fitness goal?")) return;
                record.goal = null;
                persist();
                renderGoal();
                setMessage("progressGoalMsg", "Your fitness goal has been cleared.", false);
            });
        }

        const weightForm = byId("progressWeightForm");
        if (weightForm) {
            weightForm.addEventListener("submit", function (event) {
                event.preventDefault();
                const date = todayValue();
                const raw = byId("progressWeightValue") ? byId("progressWeightValue").value.trim() : "";

                if (!raw) {
                    setMessage("progressWeightMsg", "Please enter your weight.", true);
                    return;
                }

                const parsed = parseOneDecimal(raw);
                if (parsed.status === "format") {
                    setMessage("progressWeightMsg", "Weight must be a number with up to one decimal place.", true);
                    return;
                }

                if (parsed.value < 1 || parsed.value > 500) {
                    setMessage("progressWeightMsg", "Weight must be between 1 and 500 kg.", true);
                    return;
                }

                record.weights.push({
                    id: newId("weight"),
                    date: date,
                    weight: parsed.value,
                    at: new Date().toISOString()
                });
                persist();
                byId("progressWeightValue").value = "";
                renderWeight();
                setMessage("progressWeightMsg", "Weight recorded for " + dateLabel(date) + ".", false);
            });
        }

        const weightHistory = byId("progressWeightHistory");
        if (weightHistory) {
            weightHistory.addEventListener("click", function (event) {
                const button = event.target.closest("[data-remove-weight]");
                if (!button) return;
                if (!confirm("Remove this weight entry?")) return;
                const id = button.getAttribute("data-remove-weight");
                record.weights = record.weights.filter(function (entry) { return entry.id !== id; });
                persist();
                renderWeight();
                setMessage("progressWeightMsg", "Weight entry removed.", false);
            });
        }

        const measurementForm = byId("progressMeasurementForm");
        if (measurementForm) {
            measurementForm.addEventListener("submit", function (event) {
                event.preventDefault();
                const date = todayValue();

                const values = {};
                let hasValue = false;

                for (let index = 0; index < MEASUREMENT_FIELDS.length; index += 1) {
                    const field = MEASUREMENT_FIELDS[index];
                    const input = byId(field.id);
                    const raw = input ? input.value.trim() : "";
                    if (!raw) {
                        values[field.key] = null;
                        continue;
                    }

                    const parsed = parseOneDecimal(raw);
                    if (parsed.status === "format") {
                        setMessage("progressMeasureMsg", field.label + " must be a number with up to one decimal place.", true);
                        return;
                    }

                    if (parsed.value < field.min || parsed.value > field.max) {
                        setMessage("progressMeasureMsg", field.label + " must be between " + field.min + " and " + field.max + " cm.", true);
                        return;
                    }

                    values[field.key] = parsed.value;
                    hasValue = true;
                }

                if (!hasValue) {
                    setMessage("progressMeasureMsg", "Enter at least one body measurement.", true);
                    return;
                }

                record.measurements.push(Object.assign({
                    id: newId("measure"),
                    date: date,
                    at: new Date().toISOString()
                }, values));
                persist();

                MEASUREMENT_FIELDS.forEach(function (field) {
                    if (byId(field.id)) byId(field.id).value = "";
                });
                renderMeasurements();
                setMessage("progressMeasureMsg", "Measurements saved for " + dateLabel(date) + ".", false);
            });
        }

        const measureHistory = byId("progressMeasureHistory");
        if (measureHistory) {
            measureHistory.addEventListener("click", function (event) {
                const button = event.target.closest("[data-remove-measurement]");
                if (!button) return;
                if (!confirm("Remove this measurement entry?")) return;
                const id = button.getAttribute("data-remove-measurement");
                record.measurements = record.measurements.filter(function (entry) { return entry.id !== id; });
                persist();
                renderMeasurements();
                setMessage("progressMeasureMsg", "Measurement entry removed.", false);
            });
        }

        const workoutForm = byId("progressWorkoutForm");
        if (workoutForm) {
            workoutForm.addEventListener("submit", function (event) {
                event.preventDefault();
                const day = byId("progressWorkoutDay") ? byId("progressWorkoutDay").value : WEEKDAYS[0];
                const exercise = byId("progressWorkoutExercise")
                    ? byId("progressWorkoutExercise").value.replace(/\s+/g, " ").trim()
                    : "";
                const setsRaw = byId("progressWorkoutSets") ? byId("progressWorkoutSets").value.trim() : "";
                const repsMinRaw = byId("progressWorkoutRepsMin") ? byId("progressWorkoutRepsMin").value.trim() : "";
                const repsMaxRaw = byId("progressWorkoutRepsMax") ? byId("progressWorkoutRepsMax").value.trim() : "";

                if (!exercise) {
                    setMessage("progressWorkoutMsg", "Please enter an exercise.", true);
                    return;
                }
                if (!/^[A-Za-zÑñ\s]+$/.test(exercise)) {
                    setMessage("progressWorkoutMsg", "Exercise may only contain letters and spaces. Numbers and special characters are not allowed.", true);
                    return;
                }
                if (exercise.length > WORKOUT_EXERCISE_MAX) {
                    setMessage("progressWorkoutMsg", "Exercise must be " + WORKOUT_EXERCISE_MAX + " characters or fewer.", true);
                    return;
                }

                const duplicate = record.workouts.some(function (entry) {
                    return entry.day === day &&
                        String(entry.exercise).replace(/\s+/g, " ").trim().toLowerCase() === exercise.toLowerCase();
                });
                if (duplicate) {
                    setMessage("progressWorkoutMsg", "This exercise is already in your " + day + " plan.", true);
                    return;
                }

                if (!setsRaw) {
                    setMessage("progressWorkoutMsg", "Please enter the number of sets.", true);
                    return;
                }
                if (!/^\d+$/.test(setsRaw)) {
                    setMessage("progressWorkoutMsg", "Sets must be a whole number from 1 to 20.", true);
                    return;
                }
                const sets = Number(setsRaw);
                if (sets < 1 || sets > 20) {
                    setMessage("progressWorkoutMsg", "Sets must be a whole number from 1 to 20.", true);
                    return;
                }

                if (!repsMinRaw) {
                    setMessage("progressWorkoutMsg", "Please enter the minimum reps.", true);
                    return;
                }
                if (!/^\d+$/.test(repsMinRaw)) {
                    setMessage("progressWorkoutMsg", "Minimum reps must be a whole number from 1 to 100.", true);
                    return;
                }
                const repsMin = Number(repsMinRaw);
                if (repsMin < 1 || repsMin > 100) {
                    setMessage("progressWorkoutMsg", "Minimum reps must be a whole number from 1 to 100.", true);
                    return;
                }

                if (!repsMaxRaw) {
                    setMessage("progressWorkoutMsg", "Please enter the maximum reps.", true);
                    return;
                }
                if (!/^\d+$/.test(repsMaxRaw)) {
                    setMessage("progressWorkoutMsg", "Maximum reps must be a whole number from 1 to 100.", true);
                    return;
                }
                const repsMax = Number(repsMaxRaw);
                if (repsMax < 1 || repsMax > 100) {
                    setMessage("progressWorkoutMsg", "Maximum reps must be a whole number from 1 to 100.", true);
                    return;
                }

                if (repsMin > repsMax) {
                    setMessage("progressWorkoutMsg", "Minimum reps must be less than or equal to maximum reps.", true);
                    return;
                }

                record.workouts.push({
                    id: newId("workout"),
                    day: day,
                    exercise: exercise,
                    sets: sets,
                    repsMin: repsMin,
                    repsMax: repsMax,
                    at: new Date().toISOString()
                });
                persist();

                byId("progressWorkoutExercise").value = "";
                byId("progressWorkoutSets").value = "";
                byId("progressWorkoutRepsMin").value = "";
                byId("progressWorkoutRepsMax").value = "";
                renderWorkouts();
                setMessage("progressWorkoutMsg", "Exercise added to your " + day + " plan.", false);
            });
        }

        const workoutPlan = byId("progressWorkoutPlan");
        if (workoutPlan) {
            workoutPlan.addEventListener("click", function (event) {
                const button = event.target.closest("[data-remove-workout]");
                if (!button) return;
                if (!confirm("Remove this exercise from your plan?")) return;
                const id = button.getAttribute("data-remove-workout");
                record.workouts = record.workouts.filter(function (entry) { return entry.id !== id; });
                persist();
                renderWorkouts();
                setMessage("progressWorkoutMsg", "Exercise removed from your plan.", false);
            });
        }

        const photoInput = byId("progressPhotoInput");
        const photoUploadButton = byId("progressPhotoUploadBtn");
        if (photoUploadButton && photoInput) {
            photoUploadButton.addEventListener("click", function () {
                photoInput.click();
            });

            photoInput.addEventListener("change", async function () {
                const file = photoInput.files && photoInput.files[0];
                photoInput.value = "";
                if (!file) return;

                if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
                    setMessage("progressPhotoMsg", "Please choose a JPG, PNG or WebP image.", true);
                    return;
                }
                if (file.size > PHOTO_MAX_BYTES) {
                    setMessage("progressPhotoMsg", "That image is larger than 5 MB. Please choose a smaller file.", true);
                    return;
                }

                setMessage("progressPhotoMsg", "Uploading your photo…", false);
                try {
                    const dataUrl = await resizePhotoFile(file);
                    const date = todayValue();
                    const photo = {
                        id: newId("photo"),
                        date: date,
                        dataUrl: dataUrl,
                        at: new Date().toISOString()
                    };
                    record.photos.push(photo);
                    try {
                        persist();
                    } catch (storageError) {
                        record.photos = record.photos.filter(function (entry) { return entry.id !== photo.id; });
                        setMessage("progressPhotoMsg", "We couldn't save that photo because storage is full. Remove an older photo and try again.", true);
                        return;
                    }
                    renderPhotos();
                    setMessage("progressPhotoMsg", "Progress photo uploaded.", false);
                } catch (e) {
                    setMessage("progressPhotoMsg", "That image could not be read. Please try another file.", true);
                }
            });
        }

        const gallery = byId("progressPhotoGallery");
        const lightbox = byId("progressLightbox");
        const lightboxImage = byId("progressLightboxImg");
        const lightboxClose = byId("progressLightboxClose");

        function closeLightbox() {
            if (!lightbox || !lightboxImage) return;
            lightbox.hidden = true;
            lightboxImage.removeAttribute("src");
        }

        function openLightbox(photo) {
            if (!lightbox || !lightboxImage || !photo) return;
            lightboxImage.src = photo.dataUrl;
            lightboxImage.alt = "Progress photo from " + dateLabel(photo.date);
            lightbox.hidden = false;
        }

        if (gallery) {
            gallery.addEventListener("click", function (event) {
                const removeButton = event.target.closest("[data-remove-photo]");
                if (removeButton) {
                    const id = removeButton.getAttribute("data-remove-photo");
                    if (!confirm("Remove this progress photo?")) return;
                    record.photos = record.photos.filter(function (entry) { return entry.id !== id; });
                    persist();
                    renderPhotos();
                    setMessage("progressPhotoMsg", "Progress photo removed.", false);
                    return;
                }

                const openButton = event.target.closest("[data-photo-id]");
                if (!openButton) return;
                const photo = record.photos.find(function (entry) {
                    return entry.id === openButton.getAttribute("data-photo-id");
                });
                openLightbox(photo);
            });
        }

        if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
        if (lightbox) {
            lightbox.addEventListener("click", function (event) {
                if (event.target === lightbox) closeLightbox();
            });
        }
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && lightbox && !lightbox.hidden) closeLightbox();
        });

        renderAll();
    });
})();

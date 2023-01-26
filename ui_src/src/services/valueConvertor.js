// Copyright 2022-2023 The Memphis.dev Authors
// Licensed under the Memphis Business Source License 1.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// Changed License: [Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0), as published by the Apache Foundation.
//
// https://github.com/memphisdev/memphis-broker/blob/master/LICENSE
//
// Additional Use Grant: You may make use of the Licensed Work (i) only as part of your own product or service, provided it is not a message broker or a message queue product or service; and (ii) provided that you do not use, provide, distribute, or make available the Licensed Work as a Service.
// A "Service" is a commercial offering, product, hosted, or managed service, that allows third parties (other than your own employees and contractors acting on your behalf) to access and/or use the Licensed Work or a substantial set of the features or functionality of the Licensed Work to third parties as a software-as-a-service, platform-as-a-service, infrastructure-as-a-service or other similar services that compete with Licensor products or services.

export const convertDateToSeconds = (days, hours, minutes, seconds) => {
    let totalSeconds = 0;
    totalSeconds += days !== 0 ? days * 86400 : 0;
    totalSeconds += hours !== 0 ? hours * 3600 : 0;
    totalSeconds += minutes !== 0 ? minutes * 60 : 0;
    totalSeconds += seconds !== 0 ? seconds : 0;
    return totalSeconds;
};

export const convertSecondsToDateObject = (seconds) => {
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    return {
        days,
        hours,
        minutes,
        seconds
    };
};

export const convertSecondsToDate = (seconds) => {
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;

    let result = '';
    if (days > 0) {
        result = days === 1 ? 'one day' : `${days} days`;
        if (hours > 0) {
            result = hours === 1 ? `${result}, one hour` : `${result}, ${hours} hours`;
        }
        if (minutes > 0) {
            result = minutes === 1 ? `${result}, one minute` : `${result}, ${minutes} minutes`;
        }
        if (seconds > 0) {
            result = seconds === 1 ? `${result}, one second` : `${result}, ${seconds} seconds`;
        }
    } else if (hours > 0) {
        result = hours === 1 ? 'one hour' : `${hours} hours`;
        if (minutes > 0) {
            result = minutes === 1 ? `${result}, one minute` : `${result}, ${minutes} minutes`;
        }
        if (seconds > 0) {
            result = seconds === 1 ? `${result}, one second` : `${result}, ${seconds} seconds`;
        }
    } else if (minutes > 0) {
        result = minutes === 1 ? 'one minute' : `${minutes} minutes`;
        if (seconds > 0) {
            result = seconds === 1 ? `${result}, one second` : `${result}, ${seconds} seconds`;
        }
    } else if (seconds > 0) {
        result = seconds === 1 ? 'one second' : `${seconds} seconds`;
    }

    const spliter = result.split(',');

    for (let i = 0; i < spliter.length; i++) {
        if (i === 0) {
            result = spliter[0];
        } else if (i < spliter.length - 1) {
            result = `${result}, ${spliter[i]}`;
        } else {
            result = `${result} and ${spliter[i]}`;
        }
    }
    return result;
};

export const parsingDate = (date) => {
    if (date) {
        var options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
        return new Date(date).toLocaleDateString([], options);
    } else {
        return '';
    }
};
export const parsingDateWithotTime = (date) => {
    if (date) {
        var options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(date).toLocaleDateString([], options);
    } else return '';
};

function isFloat(n) {
    return Number(n) === n && n % 1 !== 0;
}

export const convertBytes = (bytes, round) => {
    const KB = 1024;
    const MB = KB * 1024;
    const GB = MB * 1024;
    const TB = GB * 1024;
    const PB = TB * 1024;

    if (bytes < KB && bytes > 0) {
        return `${bytes} Bytes`;
    } else if (bytes >= KB && bytes < MB) {
        const parsing = isFloat(bytes / KB) ? Math.round((bytes / KB + Number.EPSILON) * 100) / 100 : bytes / KB;
        return `${round ? Math.trunc(parsing) : parsing} KB`;
    } else if (bytes >= MB && bytes < GB) {
        const parsing = isFloat(bytes / MB) ? Math.round((bytes / MB + Number.EPSILON) * 100) / 100 : bytes / MB;
        return `${round ? Math.trunc(parsing) : parsing} MB`;
    } else if (bytes >= GB && bytes < TB) {
        const parsing = isFloat(bytes / GB) ? Math.round((bytes / GB + Number.EPSILON) * 100) / 100 : bytes / GB;
        return `${round ? Math.trunc(parsing) : parsing} GB`;
    } else if (bytes >= TB && bytes < PB) {
        const parsing = isFloat(bytes / TB) ? Math.round((bytes / TB + Number.EPSILON) * 100) / 100 : bytes / TB;
        return `${round ? Math.trunc(parsing) : parsing} TB`;
    } else if (bytes >= PB) {
        const parsing = isFloat(bytes / PB) ? Math.round((bytes / PB + Number.EPSILON) * 100) / 100 : bytes / PB;
        return `${round ? Math.trunc(parsing) : parsing} PB`;
    } else {
        return '0 Bytes';
    }
};

export const numberWithCommas = (x) => {
    if (x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    } else return 0;
};

export const capitalizeFirst = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const filterArray = (arr1, arr2) => {
    const filtered = arr1.filter((el) => {
        return arr2.indexOf(el.name) === -1;
    });
    return filtered;
};

export const stationFilterArray = (arr1, arr2) => {
    const filtered = arr1.filter((station) => {
        return arr2.indexOf(station.station.name) === -1;
    });
    return filtered;
};

export const isThereDiff = (s1, s2) => {
    if (s1 === s2) {
        return false;
    }
    return true;
};

export const getUnique = (obj) => {
    const uniqueIds = [];

    const unique = obj.filter((element) => {
        const isDuplicate = uniqueIds.includes(element.name);

        if (!isDuplicate) {
            uniqueIds.push(element.name);

            return true;
        }

        return false;
    });
    return unique;
};

export const diffDate = (date) => {
    var msDiff = new Date(date).getTime() - new Date().getTime(); //Future date - current date
    var dayDiff = Math.floor(msDiff / (1000 * 60 * 60 * 24)) * -1;
    if (dayDiff === 1) {
        return 'Today';
    }
    return `${dayDiff} days ago`;
};

export const hex_to_ascii = (str1) => {
    var hex = str1.toString();
    var str = '';
    for (var n = 0; n < hex.length; n += 2) {
        str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
    }
    return str;
};

export const compareObjects = (object1, object2) => {
    const keys1 = Object.keys(object1);
    const keys2 = Object.keys(object2);
    if (keys1.length !== keys2.length) {
        return false;
    }
    for (let key of keys1) {
        if (object1[key] !== object2[key]) {
            return false;
        }
    }
    return true;
};

export const msToUnits = (value) => {
    const second = 1000;
    const minute = second * 60;
    const hour = minute * 60;
    const day = hour * 24;
    let parsing = 0;
    switch (true) {
        case value < second && value >= 100:
            return `${numberWithCommas(value)} ms`;
        case value >= second && value < minute:
            parsing = isFloat(value / second) ? Math.round((value / second + Number.EPSILON) * 100) / 100 : value / second;
            if (parsing === 1) {
                return `${parsing} second`;
            } else {
                return `${numberWithCommas(parsing)} seconds`;
            }
        case value >= minute && value < hour:
            parsing = isFloat(value / minute) ? Math.round((value / minute + Number.EPSILON) * 100) / 100 : value / minute;
            if (parsing === 1) {
                return `${parsing} minute`;
            } else {
                return `${numberWithCommas(parsing)} minutes`;
            }
        case value >= hour && value < day:
            parsing = isFloat(value / hour) ? Math.round((value / hour + Number.EPSILON) * 100) / 100 : value / hour;
            if (parsing === 1) {
                return `${parsing} hour`;
            } else {
                return `${numberWithCommas(parsing)} hours`;
            }
        case value >= day:
            parsing = isFloat(value / day) ? Math.round((value / day + Number.EPSILON) * 100) / 100 : value / day;
            if (parsing === 1) {
                return `${parsing} day`;
            } else {
                return `${numberWithCommas(parsing)} days`;
            }
        default:
            break;
    }
};

export const generateName = (value) => {
    return value?.trimStart().replaceAll(' ', '-')?.toLowerCase();
};

export const idempotencyValidator = (value, idempotencyType) => {
    const idempotencyOptions = ['Milliseconds', 'Seconds', 'Minutes', 'Hours'];

    return new Promise((resolve, reject) => {
        if (value !== '') {
            switch (idempotencyType) {
                case idempotencyOptions[0]:
                    if (value < 100) {
                        return reject('Has to be greater than 100ms');
                    }
                    if (value > 8.64e7) {
                        return reject('Has to be lower than 24 houres');
                    } else {
                        return resolve();
                    }
                case idempotencyOptions[1]:
                    if (value > 86400) {
                        return reject('Has to be lower than 24 houres');
                    } else {
                        return resolve();
                    }
                case idempotencyOptions[2]:
                    if (value > 1440) {
                        return reject('Has to be lower than 24 houres');
                    } else {
                        return resolve();
                    }
                case idempotencyOptions[3]:
                    if (value > 24) {
                        return reject('Has to be lower than 24 houres');
                    } else {
                        return resolve();
                    }
                default:
                    break;
            }
        } else {
            return reject('Please input idempotency value');
        }
    });
};

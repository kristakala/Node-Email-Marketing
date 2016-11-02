/**
 * Created by titu on 10/24/16.
 */
const promise = require('bluebird');
const fileHelper = require('../file');
const csvHandler = require('./csv');
const xlxHandler = require('./xlx');
const syntaxValidation = require('./syntax');

let startValidation = (directory, files, header) => {
    return promise.map(files, function (file) {
        return readFileAndRemoveDuplicates(directory, file, header);
    }).then((result) => {
        /*report.endTime = new Date();
        if(!_.isArray(result)) {
            result = [result];
        }
        result.forEach((r) => {
            if(r.report) {
                var tempReport = {};
                temp[r.report.fileName] = r.report;
                report =_.merge(report, temp);
            }
        });

        printReport(report);
        responseHelper.success(response, {
            report: report
        });*/
        console.log('-----Got the result-----');
        console.log(result);
        console.log('-----END-----')
        return result;
    });
};

let readFileAndRemoveDuplicates = (directory, fileName, header) => {

    let filePath = directory + '/' + fileName;
    let uniqueDirectory = directory + '/unique/';
    let uniqueFilePath = uniqueDirectory + fileName;
    let handler = getHandler(getFileExtension(fileName).toLowerCase());
    let delimiter = null;

    return fileHelper.ensureDirectoryExists(uniqueDirectory)
        .then(() => handler.readFromFileAndRemoveDupes(filePath, header))
        .then((result) => {
            if(result.delimiter) {
                delimiter = result.delimiter;
            }

            return syntaxValidation.validate(result, header);
        })
        .then((result) => {
            if(result.report) {
                result.report.fileName = fileName;
            }
            return handler.save(result, uniqueFilePath, header, delimiter);
        });
};

let getFileExtension = (fileName) => {
    return fileName.split('.').pop();
};

let getHandler = (fileExtension) => {

    var handler = null;

    switch (fileExtension) {
        case 'txt':
        case 'csv':
        case 'tsv':
        case 'text':
            handler = csvHandler;
            break;
        case 'xlsm':
        case 'xlsx':
        case 'xls':
        case 'ods':
        case 'xlt':
            handler = xlxHandler;
            break;
    }
    return handler;
};

module.exports = {
    start: startValidation
};
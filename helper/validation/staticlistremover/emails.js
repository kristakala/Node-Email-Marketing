/**
 * Created by titu on 11/1/16.
 */
const dbHelper = require('../../database');
const _ = require('lodash');
const promise = require('bluebird');
const global = require('../../../config/global');
const commonHelper = require('../../common');

let remove = (results, header, scrubOptions) => {

    let dbClient = dbHelper.dbClient;
    let containsHeader = false;
    let emailIndex = header.emailIndex || 0;
    let emailColumnHeader = null;
    let listOfEmails = [];
    let emailsToRemoved = [];

    if (_.isObject(header) && header.header === true) {
        containsHeader = true;
    }

    return promise.map(results, (result) => {
        listOfEmails = [];
        if (!result || !result.data.length) {
            return;
        }
        if (containsHeader) {
            for (var key in result.data[0]) {
                if (_.includes(global.emailKeyNames, key.toLowerCase())) {
                    emailColumnHeader = key;
                    break;
                }
            }
            listOfEmails = _.map(result.data, emailColumnHeader);
        }
        else {
            listOfEmails = _.map(result.data, function (record) {
                return record[emailIndex];
            });
        }
        return dbClient.listCollections({name: /static_list_email/})
            .toArray()
            .then((collections) => {
                collections = _.map(collections, 'name');

                return promise.map(collections, (collection) => {

                    let reportConfig = commonHelper.getReportConfig(collection);

                    if (!scrubOptions[reportConfig.paramName]) {
                        return;
                    }

                    var emailChunks = _.chunk(listOfEmails, 1000);
                    var matchedRecords = [];
                    console.log('total chunks: ', emailChunks.length);

                    return promise.map(emailChunks, function (emailChunk) {
                        return new promise(function (resolve, reject) {
                            dbClient.collection(collection).find({
                                email: {
                                    $in: emailChunk
                                }
                            }, {email: 1, _id: 0})
                                .toArray(function (err, matchedOnes) {
                                    if (err) {
                                        reject(err)
                                    }
                                    else {
                                        console.log('Retreived ', matchedOnes.length, ' records from ', collection);
                                        if (matchedOnes.length) {
                                            matchedRecords.push(_.map(matchedOnes, 'email'));
                                        }
                                        resolve();
                                    }
                                });
                        })
                    })
                        .then(function () {

                            if (matchedRecords.length) {
                                emailsToRemoved = _.union(emailsToRemoved, matchedRecords);//adding all removed emails
                            }

                            result.report.saveReports = result.report.saveReports || [];
                            result.report.saveReports.push({
                                reportName: commonHelper.getReportName(collection),
                                data: matchedRecords
                            });

                            listOfEmails = _.difference(listOfEmails, matchedRecords);
                            return;
                        })
                });

            })
            .then(() => {
                emailsToRemoved.forEach(function (email) {
                    if (containsHeader) {
                        _.remove(result.data, function (d) {
                            return d[emailColumnHeader] === email;
                        });
                    }
                    else {
                        _.remove(result.data, function (d) {
                            return d[emailIndex] === email;
                        });
                    }

                });

            })
            .then(()=> result);
    });

};

let search = (result) => {

    let dbClient = dbHelper.dbClient;

    return dbClient.listCollections({name: /static_list_email/})
        .toArray()
        .then((collections) => {
            collections = _.map(collections, 'name');

            return promise.map(collections, (collection) => {
                return new promise(function (resolve, reject) {
                    dbClient.collection(collection).findOne({
                        //email:  { $regex : new RegExp(result.email, "i") }
                        email: result.email
                    }, {}, function (err, match) {
                        if (err) {
                            reject(err);
                        }
                        else {
                            if (match) {
                                result.report[collection] = match.email;
                                result.failed = true;
                            }
                            resolve(result);
                        }
                    });
                })
            });

        })
        .then(()=> result);

};

module.exports = {
    remove: remove,
    search: search
};
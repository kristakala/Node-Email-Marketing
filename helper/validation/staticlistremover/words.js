/**
 * Created by titu on 11/1/16.
 */
const dbHelper = require('../../database');
const _ = require('lodash');
const promise = require('bluebird');
const global = require('../../../config/global');
const collection = 'static_list_badwords';
const commonHelper = require('../../common');

let remove = (results, header, scrubOptions) => {

    let dbClient = dbHelper.dbClient;
    let containsHeader = false;
    let emailIndex = header.emailIndex || 0;
    let emailColumnHeader = null;
    let emailsToRemoved = [];

    if (_.isObject(header) && header.header === true) {
        containsHeader = true;
    }

    return promise.map(results, (result) => {

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
        }

        return dbClient.listCollections({name: /static_list_words/})
            .toArray()
            .then((collections) => {
                collections = _.map(collections, 'name');

                return promise.map(collections, (collection) => {
                    let reportConfig = commonHelper.getReportConfig(collection);

                    if(!scrubOptions[reportConfig.paramName]) {
                        return;
                    }
                    return new promise(function (resolve, reject) {
                        dbClient.collection(collection).find({}, {word: 1, _id: 0})
                            .toArray(function (err, words) {
                                if (err) {
                                    reject(err);
                                }
                                else {
                                    emailsToRemoved = [];
                                    console.log('WORD: Retreived ', words.length, ' records from ', collection);
                                    if (words.length) {
                                        words = _.map(words, 'word');
                                        words.forEach(function (word) {
                                            if (containsHeader) {
                                                _.remove(result.data, function (d) {
                                                    if (d[emailColumnHeader].indexOf(word) !== -1) {
                                                        emailsToRemoved.push(d[emailColumnHeader]);
                                                        return true;
                                                    }
                                                    return false;
                                                });
                                            }
                                            else {
                                                _.remove(result.data, function (d) {
                                                    if (d[emailIndex].indexOf(word) !== -1) {
                                                        emailsToRemoved.push(d[emailIndex]);
                                                        return true;
                                                    }
                                                    return false;
                                                });
                                            }
                                        });
                                    }
                                    result.data = _.difference(result.data, emailsToRemoved);
                                    result.report.saveReports = result.report.saveReports || [];
                                    result.report.saveReports.push({
                                        reportName: commonHelper.getReportName(collection),
                                        data: emailsToRemoved
                                    });
                                    resolve();
                                }
                            });
                    })
                })

            })


    }).then(() => results);

};

let search = (result) => {

    let dbClient = dbHelper.dbClient;

    return new promise(function (resolve, reject) {
        dbClient.collection(collection).find({}, {word: 1, _id: 0})
            .toArray(function (err, badWords) {
                if (err) {
                    reject(err);
                }
                else {
                    _.each(badWords, function (badWord) {
                        if (badWord.word && result.email.indexOf(badWord.word.toLowerCase()) !== -1) {
                            result.report[collection] = badWord.word;
                            result.failed = true;
                            return false;
                        }
                    });
                    resolve(result);
                }
            });
    })
        .then(()=> result);

};

module.exports = {
    remove: remove,
    search: search
};
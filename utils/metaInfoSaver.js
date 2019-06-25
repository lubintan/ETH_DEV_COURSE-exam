module.exports = function configureMetaInfoSaver(fs) {
    Object.prototype.setB9Points = function setB9Points(points) {
        if (typeof points != "number") {
            throw new Error("points must a number, not " + typeof points);
        }
        Object.assign(this, { b9Points:  points });
        return this;
    };
    Object.prototype.setB9MustPass = function setB9MustPass(mustPass) {
        if (mustPass != "failsCode") {
            throw new Error("mustPass must be failsCode, not " + mustPass);
        }
        Object.assign(this, { b9MustPass: mustPass });
        return this;
    }
    const validMustPass = {
        failsCode: "Failing this test fails the whole coding part",
        failsFile: "Failing this test fails the test file"
    };
    const collateRec = function collateRec(suite, intoObj) {
        suite.tests.forEach(test => {
            if (typeof intoObj[test.title] === "undefined") {
                intoObj[test.title] = {};
            } else {
                throw new Error("you are trying to overwrite test " + test.title);
            }
            if (typeof test.b9Points !== "number") {
                throw new Error(`no points defined for ${test.title}`);
            }
            intoObj[test.title].points = test.b9Points;
            if (typeof test.b9MustPass !== "undefined") {
                if (typeof validMustPass[test.b9MustPass] === "undefined") {
                    throw new Error(`${test.b9MustPass} is not a valid .b9MustPass`);
                }
                intoObj[test.title].mustPass = test.b9MustPass;
            }
            intoObj[test.title].state = test.state;
            if (test.state == "failed") {
                intoObj[test.title].error = test.err.stack;
            } else if (typeof intoObj[test.title].state == "undefined") {
                intoObj[test.title].state = "failed";
            }
        });
        suite.suites.forEach(suite => {
            if (typeof intoObj[suite.title] === "undefined") {
                intoObj[suite.title] = {};
            }
            collateRec(suite, intoObj[suite.title]);
        });
    };
    return function metaInfoSaver(suite, path, filename)     {
        const resultsJson = {};
        resultsJson[suite.title] = {};
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
        }
        const fullFileName = path + "/" + filename;
        if (fs.existsSync(fullFileName)) {
            fs.unlinkSync(fullFileName);
        }
        collateRec(suite, resultsJson[suite.title]);
        fs.writeFileSync(fullFileName, JSON.stringify(resultsJson, null, 4))
    };
};
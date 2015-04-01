function splat(arr) {
  arr = arr || [];
  return arr.filter(function(x) {return x});
}

function parallel(tasks, cb) {
  var results = [], errors = [], numFinished = 0;
  tasks.forEach(function(fn, idx) {
    results[idx] = false;
    fn(function(err, res) {
      numFinished++;
      if (err) errors[idx] = err;
      results[idx] = res;
      if (numFinished == tasks.length) {
        cb(
          errors.length ? splat(errors) : null,
          splat(results),
          {results: results, errors: errors}
        );
      }
    });
  });
}

module.exports = {
  parallel: parallel
};
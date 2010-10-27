require(__dirname + "/test-helper");
var stream = new MemoryStream();
var con = new Connection({
  stream: stream
});

assert.recieved = function(stream, buffer) {
  assert.length(stream.packets, 1);
  var packet = stream.packets.pop();
  assert.equalBuffers(packet, buffer);
};

test("sends startup message", function() {
  con.startup({
    user: 'brian',
    database: 'bang'
  });
  assert.recieved(stream, new BufferList()
                  .addInt16(3)
                  .addInt16(0)
                  .addCString('user')
                  .addCString('brian')
                  .addCString('database')
                  .addCString('bang')
                  .addCString('').join(true))
});

test('sends password message', function() {
  con.password("!");
  assert.recieved(stream, new BufferList().addCString("!").join(true,'p'));
});

test('sends query message', function() {
  var txt = 'select * from boom';
  con.query(txt);
  assert.recieved(stream, new BufferList().addCString(txt).join(true,'Q'));
});

test('sends parse message', function() {
  con.parse({text: '!'});
  var expected = new BufferList()
    .addCString("")
    .addCString("!")
    .addInt16(0).join(true, 'P');
  assert.recieved(stream, expected);
});

test('sends parse message with named query', function() {
  con.parse({
    name: 'boom',
    text: 'select * from boom',
    types: []
  });
  var expected = new BufferList()
    .addCString("boom")
    .addCString("select * from boom")
    .addInt16(0).join(true,'P');
  assert.recieved(stream, expected);

  test('with multiple parameters', function() {
    con.parse({
      name: 'force',
      text: 'select * from bang where name = $1',
      types: [1, 2, 3 ,4]
    });
    var expected = new BufferList()
      .addCString("force")
      .addCString("select * from bang where name = $1")
      .addInt16(4)
      .addInt32(1)
      .addInt32(2)
      .addInt32(3)
      .addInt32(4).join(true,'P');
    assert.recieved(stream, expected);
  });
});

test('bind messages', function() {
  test('with no values', function() {
    con.bind();

    var expectedBuffer = new BufferList()
      .addCString("")
      .addCString("")
      .addInt16(0)
      .addInt16(0)
      .addInt16(0)
      .join(true,"B");
    assert.recieved(stream, expectedBuffer);
  });

  test('with named statement, portal, and values', function() {
    con.bind({
      portal: 'bang',
      statement: 'woo',
      values: [1, 'hi', null, 'zing']
    });
    var expectedBuffer = new BufferList()
      .addCString('bang')  //portal name
      .addCString('woo') //statement name
      .addInt16(0)
      .addInt16(4)
      .addInt32(1)
      .add(Buffer("1"))
      .addInt32(2)
      .add(Buffer("hi"))
      .addInt32(-1)
      .addInt32(4)
      .add(Buffer('zing'))
      .addInt16(0)
      .join(true, 'B');
    assert.recieved(stream, expectedBuffer);
  });
});


test("sends execute message", function() {

  test("for unamed portal with no row limit", function() {
    con.execute();
    var expectedBuffer = new BufferList()
      .addCString('')
      .addInt32(0)
      .join(true,'E');
    assert.recieved(stream, expectedBuffer);
  });

  test("for named portal with row limit", function() {
    con.execute({
      portal: 'my favorite portal',
      rows: 100
    });
    var expectedBuffer = new BufferList()
      .addCString("my favorite portal")
      .addInt32(100)
      .join(true, 'E');
    assert.recieved(stream, expectedBuffer);
  });
});

test('sends flush command', function() {
  con.flush();
  var expected = new BufferList().join(true, 'H');
  assert.recieved(stream, expected);
});

test('sends sync command', function() {
  con.sync();
  var expected = new BufferList().join(true,'S');
  assert.recieved(stream, expected);
});

test('sends end command', function() {
  con.end();
  var expected = new Buffer([0x58, 0, 0, 0, 4]);
  assert.recieved(stream, expected);
});
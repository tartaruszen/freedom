/*globals fdom:true, handleEvents, mixin, XMLHttpRequest */
/*jslint indent:2,white:true,node:true,sloppy:true */
if (typeof fdom === 'undefined') {
  fdom = {};
}
fdom.port = fdom.port || {};

/**
 * A freedom application which processes control messages manage hub routing.
 * @class Manager
 * @extends Port
 * @param {Hub} hub The routing hub to control.
 * @constructor
 */
fdom.port.Manager = function(hub) {
  this.id = 'control';
  this.config = {};
  this.flows = {};
  this.hub = hub;
  this.delegate = null;
  this.toDelegate = {};
  
  this.hub.on('config', function(config) {
    mixin(this.config, config);
    this.emit('config');
  }.bind(this));
  
  handleEvents(this);
  this.hub.register(this);
};

/**
 * Provide a textual description of this port.
 * @method toString
 * @return {String} the description of this port.
 */
fdom.port.Manager.prototype.toString = function() {
  return "[Local Controller]";
};

/**
 * Process messages sent to this port.
 * The manager, or 'control' destination handles several types of messages,
 * identified by the request property.  The actions are:
 * 1. debug. Prints the message to the console.
 * 2. link. Creates a link between the source and a provided destination port.
 * 3. create. Registers the provided port with the hub.
 * 4. port. Creates a link between the source and a described port type.
 * 5. bindapp. Binds a custom channel from a defined source to described port type.
 * 6. delegate. Routes a defined set of control messages to another location.
 * 7. resource. Registers the source as a resource resolver.
 * 8. core. Generates a core provider for the requester. 
 * @method onMessage
 * @param {String} flow The source identifier of the message.
 * @param {Object} message The received message.
 */
fdom.port.Manager.prototype.onMessage = function(flow, message) {
  var reverseFlow = this.flows[flow], origin;
  if (!reverseFlow) {
    console.warn("Unknown message source: " + flow);
    return;
  }
  origin = this.hub.getDestination(reverseFlow);

  if (this.delegate && reverseFlow !== this.delegate && this.toDelegate[flow]) {
    // Ship off to the delegee
    this.emit(this.delegate, {
      type: 'Delegation',
      request: 'handle',
      quiet: true,
      flow: flow,
      message: message
    });
    return;
  }

  if (message.request === 'debug') {
    if (this.config.debug) {
      fdom.debug.print(message);
    }
    return;
  }

  if (message.request === 'link') {
    this.createLink(origin, message.name, message.to, message.overrideDest);
  } else if (message.request === 'create') {
    this.setup(origin);
  } else if (message.request === 'port') {
    if (message.exposeManager) {
      message.args = this;
    }
    this.createLink(origin, message.name, 
        new fdom.port[message.service](message.args));
  } else if (message.request === 'bindport') {
    this.createLink({id: message.id},
                    'custom' + message.port,
                    new fdom.port[message.service](message.args),
                    'default',
                    true);
  } else if (message.request === 'delegate') {
    // Initate Delegation.
    if (this.delegate === null) {
      this.delegate = reverseFlow;
    }
    this.toDelegate[message.flow] = true;
  } else if (message.request === 'resource') {
    fdom.resources.addResolver(message.args[0]);
    fdom.resources.addRetriever(message.service, message.args[1]);
  } else if (message.request === 'core') {
    if (this.core && reverseFlow === this.delegate) {
      (new this.core()).onMessage(origin, message.message);
      return;
    }
    this.getCore(function(to, core) {
      this.hub.onMessage(to, {
        type: 'core',
        core: core
      });
    }.bind(this, reverseFlow));
  } else {
    console.warn("Unknown control request: " + message.request);
    console.log(JSON.stringify(message));
    return;
  }
};

/**
 * Set up a port with the hub.
 * @method setup
 * @param {Port} port The port to register.
 */
fdom.port.Manager.prototype.setup = function(port) {
  if (!port.id) {
    console.warn("Refusing to setup unidentified port ");
    return false;
  }

  if(this.flows[port.id]) {
    console.warn("Refusing to re-initialize port " + port.id);
    return false;
  }

  if (!this.config.global) {
    this.once('config', this.setup.bind(this, port));
    return;
  }

  this.hub.register(port);
  var flow = this.hub.install(this, port.id, "control"),
      reverse = this.hub.install(port, this.id, port.id);
  this.flows[port.id] = flow;

  this.hub.onMessage(flow, {
    type: 'setup',
    channel: reverse,
    config: this.config
  });

  return true;
};

/**
 * Create a link between two ports.  Links are created in both directions,
 * and a message with those capabilities is sent to the source port.
 * @method createLink
 * @param {Port} port The source port.
 * @param {String} name The flow for messages from destination to port.
 * @param {Port} destiantion The destination port.
 * @param {String} [destName] The flow name for messages to the destination.
 * @param {Boolean} [toDest] Tell the destination rather than source about the link.
 */
fdom.port.Manager.prototype.createLink = function(port, name, destination, destName, toDest) {
  if (!this.config.global) {
    this.once('config', this.createLink.bind(this, port, name, destination, destName));
    return; 
  }

  if (!this.flows[destination.id]) {
    if(this.setup(destination) === false) {
      return;
    }
  }
  var outgoingName = destName || 'default',
      outgoing = this.hub.install(port, destination.id, outgoingName),
      reverse;

  // Recover the port so that listeners are installed.
  destination = this.hub.getDestination(outgoing);
  reverse = this.hub.install(destination, port.id, name);

  if (toDest) {
    this.hub.onMessage(this.flows[destination.id], {
      type: 'createLink',
      name: outgoingName,
      channel: reverse,
      reverse: outgoing
    });
  } else {
    this.hub.onMessage(this.flows[port.id], {
      name: name,
      type: 'createLink',
      channel: outgoing,
      reverse: reverse
    });
  }
};

fdom.port.Manager.prototype.getCore = function(cb) {
  if (this.core) {
    cb(this.core);
  } else {
    fdom.apis.getCore('core', this).done(function(core) {
      this.core = core;
      cb(this.core);
    }.bind(this));
  }
};


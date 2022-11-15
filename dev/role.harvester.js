var Traveler = require('Traveler');
var u = require('util.common');

var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        
        if(!creep.store.getCapacity() || creep.store.getCapacity() == 0 || creep.store.getFreeCapacity() > 0) {
            var source = Game.getObjectById(creep.memory.source);
            var wasRemoteRoom = false; // to check for blindness, not remoteness
            
            // 2
            //TODO - i have vision of rooms so will know sources sometimes, i think it expires cache then triggers below eventually, but its stuck for many ticks at first
            if(!source) {
                //determine if remote before finding sources
                _.forEach( Memory.rooms[creep.memory.homeRoom].remoteSources, (remoteSource) => {
                    if(remoteSource.id == creep.memory.source) {
                        var source = Game.getObjectById(creep.memory.source);
                        if( source )
                            creep.Move(new RoomPosition(source.pos.x,source.pos.y,remoteSource.room),{allowSK:true});
                        else
                            creep.Move(new RoomPosition(remoteSource.x,remoteSource.y,remoteSource.room),{allowSK:true}); // TODO - I think it can't see pos.x etc if no vision and this is backup, but can save with state machine
                        wasRemoteRoom = true;
                    }
                })
               
                // 3

                //otherwise find local room sources
                if( !wasRemoteRoom ) {
                    var sources = creep.room.find(FIND_SOURCES);
                    source = sources[1];
                    if (!source) {
                        source = sources[0];
                    }
                    creep.memory.source = source.id;
                }

            }

            var result = creep.harvest(source);
            if(result == ERR_NOT_IN_RANGE) {
                creep.Move(source, {allowSK:true});
                return;
            }
            else if(result == OK) {
                if( !creep.memory.baseRange ) {
                    creep.memory.baseRange = this.getBaseRange(creep);
                    creep.memory.transportCoverage = this.getTransportCoverage(creep);
                }
            }
            
            
        }
        
        else {
                        
            if( creep.memory.targetRoom && creep.room.name != creep.memory.targetRoom ) {
                var destRoom = new RoomPosition(25,25,creep.memory.targetRoom);
                var result = creep.Move(destRoom, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            else {

                let result;
                if(creep.memory.tempTarget) {
                    this.gotoTempTarget(creep);
                    return;
                }

                if( (!creep.memory.targetRoom || (creep.memory.targetRoom && creep.memory.targetRoom == creep.memory.homeRoom)) &&
                    (Memory.rooms[creep.memory.homeRoom].links && Object.keys(Memory.rooms[creep.memory.homeRoom].links).length > 2 )) {

                    let link = false;
                    if(creep.memory.link) {
                        link = Game.getObjectById(creep.memory.link);
                        if(creep.memory.transportList) {
                            this.clearLinkedTransports(creep);
                            creep.memory.transportCoverage = -1; //-1 is handled as a flag not to process transport validation and re-setup transportData
                        }
                    }

                    if(!link) {
                        this.assignLink(creep)
                        if(creep.memory.link) {
                            link = Game.getObjectById(creep.memory.link);
                            this.clearLinkedTransports(creep);
                            creep.memory.transportCoverage = -1; //-1 is handled as a flag not to process transport validation and re-setup transportData
                        }
                    }

                    if(link && (link.store.getFreeCapacity(RESOURCE_ENERGY) >= 50) ) {                    
                        result = creep.transfer(link,RESOURCE_ENERGY);
                        if(result == OK) {
                            let source = Game.getObjectById(creep.memory.source);
                            result = creep.harvest(source);
                            if(result == OK) {
                                return;
                            }
                        }
                        if(result == ERR_NOT_IN_RANGE)
                            creep.Move(link);
                        return;
                    }
                }

                //TODO must handle this in statemachine as its expensive every tick - also check initializer check for transport presence in home room
                //check if we have transports before dropping on floor at source
                let transports = _.filter( Game.creeps, (c) => {
                    return c.memory.role == "transport" && c.memory.homeRoom == creep.memory.homeRoom && c.memory.target == creep.id
                });

                if( transports && transports.length > 0 ) {
                    for(var i=0;i<transports.length;i++) {
                        if(creep.pos.isNearTo(transports[i])) {
                            for(const resourceType in creep.store) {
                                result = creep.transfer(transports[i],resourceType);
                                if( result == OK )
                                    break;
                            }
                            if(result == OK) {
                                let source = Game.getObjectById(creep.memory.source);
                                result = creep.harvest(source);
                                if(result == OK || result == ERR_TIRED) {
                                    return;
                                }
                            }
                        }
                    }
                    for(const resourceType in creep.store) {
                        let result = creep.drop(resourceType);                        
                        // u.debug(resourceType,`stateEmptyStore in drop logic`);
                        if( result == OK )
                            break;
                    }
                    return;
                }

                //if no transports, we must deliver to spawn sources
                var targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                
                if(targets[0]) {
                    creep.memory.tempTarget = targets[0].id;
                }
                else {
                    for(const resourceType in creep.store) {
                        let result = creep.drop(resourceType); //failsafe to stop deadlock fatal error that stops spawn from working
                        // u.debug(resourceType,`stateEmptyStore in drop logic`);
                    }
                    
                }
            
                this.gotoTempTarget(creep);
                
            }
        }
    },

    gotoTempTarget: function(creep) {
        let result;
        for(const resourceType in creep.store) {
            result = creep.transfer(Game.getObjectById(creep.memory.tempTarget), resourceType); //overridden by drop but compensating with transports for now.
            // u.debug(resourceType,`stateEmptyStore in drop logic`);
        }
            
        if(result == ERR_NOT_IN_RANGE) {
            creep.Move(Game.getObjectById(creep.memory.tempTarget), {visualizePathStyle: {stroke: '#ffffff'}});
        }
        else
            delete creep.memory.tempTarget;
        
    },

    /** @param {Creep} creep **/
    getBaseRange: function(creep) {

        if( creep.memory.baseRange && creep.memory.baseRange > 1 ){
            return creep.memory.baseRange;
        }
      
        //if not already set and sent like above shows, let's calculate it
        let baseTargetPos;
        if(Game.rooms[creep.memory.homeRoom].storage)
            baseTargetPos = Game.rooms[creep.memory.homeRoom].storage.pos;
        else {
            _.forEach( Game.spawns, (spawn) => {
                if( spawn.room.name == creep.memory.homeRoom ) {
                    baseTargetPos = spawn.pos;
                    return false; //breaks the lodash forEach loop
                }
            });            
        }

        if( !baseTargetPos ) {
            throw ("Exception thrown: harvester can't find baseTarget for setting transport links up");
        }

        //harvester's source position won't be accessible if we have no vision in room, so have to handle that scenario.
        let creepSourcePos = false;
        try {
            let sourcePos = Game.getObjectById(creep.memory.source).pos;
            if(sourcePos instanceof RoomPosition) {
                creepSourcePos = sourcePos;
            }
        }
        catch(e) {
            //this works fine so commenting out the log spam - it just moves to remote room for now, TODO should change to x y json asap
            console.log("Exception thrown: harvester getBaseRange can't get creep's source position probably because its blind. Returning -1");
            return -1;
        }

        if(creepSourcePos) {
            var path = creep.findTravelPath(creepSourcePos, baseTargetPos).path;
            if(!path.length || path.length == 0) {
                throw ("Exception thrown: role.harvester getBaseRange() can't find valid path length to base for setting transport links up: path object from Traveler is "+JSON.stringify(path));
            }
            creep.memory.baseRange = path.length - 1; //need to -1 because distance is to object not to space next to it whcih is all we need.
        }
        else {
            console.log("Logic issue: role.harvester getBaseRange() can't get creep's source position probably because its blind: creepSourcePos: "+JSON.stringify(creepSourcePos));
            console.log("creep.memory.source.pos: "+JSON.stringify(creep.memory.source.pos));
            return -1;
        }

        //if we're only getting the baseRange now, it means we have no transportCoverage yet either.
        creep.memory.transportCoverage = 0;

        //we'll only get here if its first time we set it up so let's return it then
        if( creep.memory.baseRange < 1)
            creep.memory.baseRange = 1;
        return creep.memory.baseRange;
    },

    /** @param {Creep} creep **/
    getTransportCoverage: function(harvesterCreep) {
        
        //this is a flag to prevent processing rest of function e.g. harvester as Link structure or not valid transport target for other reason.
        if(harvesterCreep.memory.transportCoverage && harvesterCreep.memory.transportCoverage == -1 ) {
            return -1;
        }

        //console.log(`getTransportCoverage harvester ${harvesterCreep.name} room:${harvesterCreep.room}`);
        if( !harvesterCreep.memory.transportCoverage || harvesterCreep.memory.transportCoverage < 0 ){ // the < 0 is a graceful failsafe incase the above mechanism doesn't work
            harvesterCreep.memory.transportCoverage = 0;
            harvesterCreep.memory.transportList = [];
            //console.log(`getTransportCoverage transportCoverage init 0`);
        }

        //validate if transportCoverage sources as still alive, if not, remove them from the coverage count
        if( !harvesterCreep.memory.transportList ) {
            harvesterCreep.memory.transportList = [];
            //console.log(`getTransportCoverage transportList init 0`);
        }

        var updatedTotalCoverage = 0;
        var updatedTransportList = [];
        for(var t in harvesterCreep.memory.transportList) {
            let transportCreep = Game.getObjectById(harvesterCreep.memory.transportList[t].id);
            //console.log(`getTransportCoverage transport id ${JSON.stringify(harvesterCreep.memory.transportList[t].id)}`);
            if(transportCreep)
                if(transportCreep.memory.target == harvesterCreep.id){
                    updatedTotalCoverage += harvesterCreep.memory.transportList[t].coverage;
                    updatedTransportList.push(harvesterCreep.memory.transportList[t]);
                }
                //console.log(`getTransportCoverage updatedTotalCoverage += ${harvesterCreep.memory.transportList[t].coverage}`);
            
        }
        
        harvesterCreep.memory.transportCoverage = updatedTotalCoverage;
        
        //console.log(`getTransportCoverage updatedTotalCoverage finally ${updatedTotalCoverage}`);
        //console.log(`getTransportCoverage harvesterCreep.memory.transportCoverage finally ${harvesterCreep.memory.transportCoverage}`);
        harvesterCreep.memory.transportList = updatedTransportList;
        return harvesterCreep.memory.transportCoverage;
    },

    /** @param {Creep} harvesterCreep **/
    /** @param {string} transportId **/
    /** @param {number} transportCoverage **/
    setTransportCoverage: function(harvesterCreep,transportId,transportCoverage) {

        //console.log(`setTransportCoverage harvester ${harvesterCreep.name} room:${harvesterCreep.room} setting ${transportId} with ${transportCoverage}`);

        //if not initialized yet, instantiate the attribute for later use
        if( !harvesterCreep.memory.transportCoverage ){
            harvesterCreep.memory.transportCoverage = 0;
            //console.log(`setTransportCoverage transportCoverage init 0`);
        }
        harvesterCreep.memory.transportCoverage += transportCoverage;

        //same as above for transportList
        if( !harvesterCreep.memory.transportList ) {
            harvesterCreep.memory.transportList = [];
            //console.log(`setTransportCoverage transportList init 0`);
        }
        let transportRegister = {id:transportId,coverage:transportCoverage};
        
        //console.log(`setTransportCoverage transportRegister ${JSON.stringify(transportRegister)}`);

        harvesterCreep.memory.transportList.push(transportRegister);
    },

    assignLink(creep) {
        let links = Game.rooms[creep.room.name].find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_LINK)
            }});

        _.forEach( links, (l) => {
            if(l.pos.isNearTo(creep)) {
                creep.memory.link = l.id;
                return false; //breaks lodash foreach
            }
        });

    },

    clearLinkedTransports(creep) {
        _.forEach(creep.memory.transportList, (transportData) => {
            let transport = Game.getObjectById(transportData.id);
            delete transport.memory.target;
        });
        delete creep.memory.transportList;
    }
};

module.exports = roleHarvester;
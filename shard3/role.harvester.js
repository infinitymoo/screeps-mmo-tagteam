var Traveler = require('Traveler');

/** Limitations
 * 1 - TO TEST check to see what harvester does at every RCL / base development level with its behaviour to make sure its robust
 * 2 - must specify source in memory parms when spawning and is currently manual
 * 
 */


/* Summary Behaviour

** 1 - If creep has cargo capacity it will do following, otherwise it will go to number 5. First goal is to get the source object, but there's poitns of failure for it as follows;
** 2 - If a source is not within vision it will not get the object id, so we have to see if the source is in our registered list of remoteSources and direct the creep there first
** 3 - if we didn't have a source set from creep memory but the cause wasn't blindness to remote source objects, then default to second source then first source if that failed, in current room, and remember it
** 4 - If we didn't successfully run the code for identifying and going to a remote source we are blind to, deduce that are we're either already at the remote source's room or we have a local one to harvest so lets harvest or move to the current room's source target

** 5 - Alternative to number 1, it means we have no spare capacity in our cargo hold
** 6 - if we have the memory static flag set, drop the resources we had in cargo on the ground
** 7 - if the target property (which stores harvester's target room name) has a valid value of an existing game room, and its not the one the creep is in, move to it. Otherwise
*/

var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        // 1
        if(creep.store.getFreeCapacity() > 0) {
            var source = Game.getObjectById(creep.memory.source);
            var wasRemoteRoom = false;
            
            // 2
            //TODO - i have vision of rooms so will know sources sometimes, i think it expires cache then triggers below eventually, but its stuck for many ticks at first
            if(!source) {
                //determine if remote before finding sources
                _.forEach( Memory.rooms[Memory.homeRoom].remoteSources, (remoteSource) => {
                    if(remoteSource.id == creep.memory.source) {
                        var source = Game.getObjectById(creep.memory.source);
                        if( source )
                            creep.travelTo(new RoomPosition(source.pos.x,source.pos.y,remoteSource.room));
                        else
                            creep.travelTo(new RoomPosition(25,25,remoteSource.room)); // TODO - I think it can't see pos.x etc if no vision and this is backup, but can save with state machine
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

            // 4
            
            if( !wasRemoteRoom ) {
                var result = creep.harvest(source);
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
                }
                else if(result == OK) {

                    if( !creep.memory.baseRange ) {
                        creep.memory.baseRange = this.getBaseRange(creep);
                        creep.memory.transportCoverage = this.getTransportCoverage(creep);
                    }
                }
            }
            
        }
        // 5
        else {

            // 6
            //TO DO I don't think this is used or necessary anymore, and used to be manually set too.
            if(creep.memory.static) {
                // var containerBuild = creep.pos.isNearTo();
                // if() {
                //     creep.pos.isNearTo()
                // }
                
                creep.drop(RESOURCE_ENERGY);
                return;
            }
            
            // 7
            
            var targetRoom = Game.rooms[creep.memory.target];
            
            if( targetRoom && creep.room.name != targetRoom.name ) {
                var destRoom = new RoomPosition(25,25,targetRoom.name);
                var result = creep.travelTo(destRoom, {visualizePathStyle: {stroke: '#ffffff'}});
            }
            else {

                if(creep.memory.tempTarget) {
                    this.gotoTempTarget(creep);
                    return;
                }

                //TODO must handle this in statemachine as its expensive every tick - also check initializer check for transport presence in home room
                //check if we have transports before dropping on floor at source
                let transports = _.filter( Game.creeps, (creep) => {
                    return creep.memory.role == "transport"
                });

                if( transports && transports.length > 0 ) {
                    creep.drop(RESOURCE_ENERGY);
                    return;
                }

                //if no transports, we must deliver to spawn sources
                var target;
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
                    creep.drop(RESOURCE_ENERGY); //failsafe to stop deadlock fatal error that stops spawn from working
                }
            
                this.gotoTempTarget(creep);
                
            }
        }
    },

    gotoTempTarget: function(creep) {
        var result = creep.transfer(Game.getObjectById(creep.memory.tempTarget), RESOURCE_ENERGY); //overridden by drop but compensating with transports for now.
            
        if(result == ERR_NOT_IN_RANGE) {
            creep.travelTo(Game.getObjectById(creep.memory.tempTarget), {visualizePathStyle: {stroke: '#ffffff'}});
        }
        else if( result == OK ) {
            delete creep.memory.tempTarget;
            //creep.drop(RESOURCE_ENERGY); //failsafe to stop running back to source with energy in storage fatal error that stops spawn from working
        }
    },

    /** @param {Creep} creep **/
    getBaseRange: function(creep) {

        if( creep.memory.baseRange && creep.memory.baseRange > 1 ){
            return creep.memory.baseRange;
        }
      
        //if not already set and sent like above shows, let's calculate it
        var baseTarget = Game.rooms[creep.memory.homeRoom].find(FIND_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_STORAGE ||
                    structure.structureType == STRUCTURE_SPAWN);
            }
        });
        if( !baseTarget[0] ) {
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
            console.log("Exception thrown: harvester getBaseRange can't get creep's source position probably because its blind. Returning -1");
            return -1;
        }

        if(creepSourcePos) {
            var path = creep.findTravelPath(creepSourcePos, baseTarget[0].pos).path;
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
        return creep.memory.baseRange;
    },

    /** @param {Creep} creep **/
    getTransportCoverage: function(creep) {
        if( !creep.memory.transportCoverage ){
            creep.memory.transportCoverage = 0;
        }

        //validate if transportCoverage sources as still alive, if not, remove them from the coverage count
        var indexCounter = 0;        
        var hasUpdate = false;
        var updatedTotalCoverage = 0;
        for(var transport in creep.memory.transportList) {
            let transportCreep = Game.getObjectById(transport.id);
            if(!transportCreep) {
                delete creep.memory.transportList[indexCounter];
                hasUpdate = true;
            }
            else {
                updatedTotalCoverage += creep.memory.transportList[indexCounter].coverage;
            }
            indexCounter++;
        }
        if( hasUpdate ) {
            creep.memory.transportCoverage = updatedTotalCoverage;
        }

        return creep.memory.transportCoverage;
    },

    /** @param {Creep} harvesterCreep **/
    /** @param {string} transportId **/
    /** @param {number} transportCoverage **/
    setTransportCoverage: function(harvesterCreep,transportId,transportCoverage) {
        //if not initialized yet, instantiate the attribute for later use
        if( !harvesterCreep.memory.transportCoverage ){
            harvesterCreep.memory.transportCoverage = 0;
        }
        harvesterCreep.memory.transportCoverage += transportCoverage;

        //same as above for transportList
        if( !harvesterCreep.memory.transportList ) {
            harvesterCreep.memory.transportList = [];
        }
        harvesterCreep.memory.transportList.push({id:transportId,coverage:transportCoverage});
    }
};

module.exports = roleHarvester;
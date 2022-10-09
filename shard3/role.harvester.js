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
            
            if( !wasRemoteRoom )
                if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                    creep.travelTo(source, {visualizePathStyle: {stroke: '#ffaa00'}});
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
                    target = targets[0];
                }
                else
                    creep.drop(RESOURCE_ENERGY); //failsafe to stop deadlock fatal error that stops spawn from working
            
                var result = creep.transfer(target, RESOURCE_ENERGY); //overridden by drop but compensating with transports for now.
            
                if(result == ERR_NOT_IN_RANGE) {
                    creep.travelTo(target, {visualizePathStyle: {stroke: '#ffffff'}});
                }
                else if( result == OK )
                   creep.drop(RESOURCE_ENERGY); //failsafe to stop running back to source with energy in storage fatal error that stops spawn from working
                
            }
        }
    }
};

module.exports = roleHarvester;
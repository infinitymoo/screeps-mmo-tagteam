var Traveler = require('Traveler');
var u = require('util.common');
var taskCommon = require('task.common');

//Context
var creepStateMachine = {
    
    stateList:[],
    stateParms:[],
    currentState:{},
    currentParms:{},
    
    completedStates:[],

    creep:{},

    /** @param {Creep} creep **/
    run: function(creep) {
        //pre-initialization validation
        if(creep.spawning)
            return;

        //initialize
        if( creep )
            this.creep = creep;
        
        if( creep.memory.stateParms )
            this.stateParms = creep.memory.stateParms;
        else {
            if( creep.memory.role == "harvester" )
                this.stateParms.push({memory:"source"});
        }

        if( creep.memory.stateList )
            this.stateList = creep.memory.stateList;
        else {
            if( creep.memory.role == "harvester" )
                this.stateList.push("stateHarvest");
        }

        this.currentState = _.last(this.stateList);
        this.currentParms = _.last(this.stateParms);

        //execute
        if(this.stateList.length > 0)
            this.stateRun();
    },

    stateRun() {
        u.debug(this.stateList,`harvester current state`);
        u.debug(this.stateParms,`harvester current state`);
        u.debug(this.currentState,`harvester current state`);

        if( !_.includes(this.completedStates,this.currentState) ) {
            switch(this.currentState) {
                case "stateHarvest": stateHarvest.run(this.currentParms, this); break;
                case "stateTravel": stateTravel.run(this.currentParms, this); break;
                case "stateEmptyStore": stateEmptyStore.run(this.currentParms, this); break;
                case "stateCooldown": stateCooldown.run(this.currentParms, this); break;
                default:
                    this.stateRemove();
                    break;
            }
        }
    },

    stateAdd( state, stateParms = {} ) {
        u.debug(state,`stateAdd`);

        //validate
        if(!state )
            u.debug(state,`trying to add a falsey state`);
        //execute
        else {            
            this.stateList.push(state);
            this.stateParms.push(stateParms);

            this.completedStates.push(this.currentState);

            this.currentState = _.last(this.stateList);
            this.currentParms = _.last(this.stateParms);
            this.stateRun();
        }
    },

    stateRemove() {
        u.debug(this.currentState,`stateRemove`);

        this.completedStates.push(this.currentState);

        if(this.stateList.length > 1) {
            this.stateList.pop();
            this.stateParms.pop();

            this.currentState = _.last(this.stateList);
            this.currentParms = _.last(this.stateParms);
        }
        this.stateRun();
    },

    stateSave() {
        this.creep.memory.stateList = this.stateList;
        this.creep.memory.stateParms = this.stateParms;

        delete this.completedStates;
    }
}

var stateHarvest = {

    run: function(stateParms, stateMachine) {
        let creep = stateMachine.creep;
        let result = creepTask.taskHarvestResource(creep,stateParms);

        // u.debug(result,`harvest result code`);

        switch(result) {
            case ERR_NOT_IN_RANGE: //not close enough to harvest
            case ERR_NOT_FOUND: //can't see target, maybe blind to room
            case ERR_INVALID_TARGET: //can't see target, maybe blind to room
                u.debug(result,`in first 3 error switches`);
                stateMachine.stateAdd("stateTravel",{memory:'source'});
                break;
            case ERR_NOT_ENOUGH_RESOURCES: //only expect this with regenerating sources
            case ERR_TIRED: //only expect this with minerals and things with cooldowns
                // u.debug(result,`in tired error switch`);
                stateMachine.stateAdd("stateCooldown",{memory:'source'});
                break;
            case OK:
                // u.debug(result,`in OK switch`);
                creepRole.event(creep,"stateHarvest",result);
                if(creep.store.getFreeCapacity() == 0) {
                    // u.debug(result,`in no free capacity switch`);
                    stateMachine.stateAdd( creepRole.getJob(creep.memory.role) );
                }
                break;
            case ERR_FULL:
                // u.debug(result,`in ERR_FULL switch`);
                stateMachine.stateAdd( creepRole.getJob(creep.memory.role) );
                break;
            default:
                stateMachine.stateRemove();
                break;
        }
    }
}

var stateTravel = {
    run: function(stateParms, stateMachine) {
        let creep = stateMachine.creep;
        let result = creepTask.taskTravel(creep,stateParms);

        u.debug(result,`stateTravel for creep ${creep.name}`);

        switch(result) {
            case ERR_TIRED: //wait until fatigue is zero, do nothing
                break;
            case ERR_INVALID_TARGET:
            case ERR_NOT_FOUND:
                u.debug(result,`stateTravel for creep ${creep.name} got bad result, removing from state stack`);
            case OK:
            default:
                stateMachine.stateRemove();
                break;
        }
    }
}

// it is best to set supplyTargets for anything that needs to be emptied e.g. harvesters when they are created
var stateEmptyStore = {
    run: function(stateParms, stateMachine) {
        //initialize
        let result = false;;
        let creep = stateMachine.creep;
        let stateParmKeys = Object.keys( stateParms );
        let targetParm = creepRole.resolveLogisticsTarget(creep);

        // u.debug(targetParm,`stateEmptyStore pre validate`);

        //validate
        if( !targetParm ) {
            //try to find and save a validTarget if none set
            targetParm = creepRole.findLogisticsTarget(creep);
            //if that fails or we ourselves are the logistics target, just drop all resources
            if( !targetParm || targetParm.id == creep.id ) {
                // u.debug(creep.store,`stateEmptyStore pre drop logic`);
                for(const resourceType in creep.store) {
                    result = creep.drop(resourceType);
                    // u.debug(resourceType,`stateEmptyStore in drop logic`);
                    if( result == OK )
                        break;
                }
                // u.debug(result,`stateEmptyStore post drop logic result`);
            }
        }

        // u.debug(targetParm,`stateEmptyStore pre taskTransfer`);

        if( !result )
            result = creepTask.taskTransfer(creep,targetParm);

        switch(result) {
            case ERR_NOT_IN_RANGE:
                // u.debug(result,`in stateEmptyStore ERR_NOT_IN_RANGE switch`);
                stateMachine.stateAdd("stateTravel",targetParm);
                break;
            case ERR_INVALID_TARGET:
            case ERR_NOT_FOUND:
            case OK:
            default:
                stateMachine.stateRemove();
                break;
        }      
    }
}

/**
 * Looks in creep memory cooldown or determines where to set cooldown from based on memory arg object type
 */
var stateCooldown = {
    run: function(stateParms, stateMachine) {
        //initialize
        let creep = stateMachine.creep;
        let cooldown = creep.memory.cooldown;

        //validate and execute
        if( cooldown )
            if( Game.time >= cooldown ) {
                delete creep.memory.cooldown;
                return OK;
            }
            else {
                return ERR_TIRED;
            }
        else {
            if(stateParms.memory) {
                let cooldownSource = Game.getObjectById(creep.memory[stateParms.memory]);
                if( cooldownSource instanceof Mineral ) {
                    let extractor = creep.pos.findInRange(FIND_STRUCTURES, 1, {
                        filter: (structure) => {
                            return structure.structureType == STRUCTURE_EXTRACTOR;
                        }
                    });
                    if( extractor && extractor.cooldown )
                        creep.memory.cooldown = Game.time + extractor.cooldown;
                }
            }
            if( creep.memory.cooldown )
                return ERR_TIRED;
        }
    }
}

var creepTask = {

    /**
     * Harvests resource by id from taskParms.memory key or closest Source
     * @param {Creep} creep 
     * @param {Collection} taskParms 
     * @returns Screeps Result Codes
     */
    taskHarvestResource: function(creep,taskParms) {
        //initialize
        //let taskParmKeys = Object.keys(taskParms);
        let resourceId;
        let taskParmLocation = taskParms.memory;
        if( taskParmLocation )
            resourceId = creep.memory[taskParmLocation];
        
        let resource = Game.getObjectById(resourceId);

        //validate
        if( !resource ) {
            resource = creep.pos.findClosestByPath(FIND_SOURCES);
            creep.memory[taskParmLocation] = resource.id;
        }

        if(creep.store.getFreeCapacity() == 0)
            return ERR_FULL;

        if(!resource)
            return ERR_NOT_FOUND;
        
        //execute
        let result = creep.harvest( resource );
        return result;
    },
    

    /**
     * Travels to target with taskParms.roomPos or taskParms.memory value
     * @param {Creep} creep 
     * @param {Collection} taskParms 
     * @returns 
     */
     taskTravel: function(creep, taskParms) {
        //initialize
        let destPos;
        let taskParmKeys = Object.keys(taskParms);
        if( _.includes(taskParmKeys, "roomPos") ) {
            destPos = new RoomPosition(
                taskParms.roomPos.x,
                taskParms.roomPos.y,
                taskParms.roomPos.room,
            );
        }
        else if( _.includes(taskParmKeys, "memory") ) {
            destPos = Game.getObjectById(creep.memory[taskParms.memory]).pos;
            //if we still can't see it, assume room blindness and do lookups on memory storage
            if( !destPos ) {
                destPos = creepRole.resolveTravelTarget(creep,taskParms);
            }
        }

        //validate
        if(!destPos)
            return ERR_NOT_FOUND;

        //execute
        let travelParms;
        if( taskParms.travel )
            travelParms = taskParms.travel;
        else
            travelParms = {};

        let result = creep.travelTo(destPos,travelParms);
        return result;
    },

    /**
     * 
     * @param {Creep} creep 
     * @param {Collection} taskParms 
     * @returns 
     */
    taskTransfer: function(creep,taskParms) {
        //initialize
        let result = false;
        let taskParmKeys = Object.keys(taskParms);

        //execute
        if( _.includes(taskParmKeys, "memory") ) {
            let transferTarget = Game.getObjectById(creep.memory[taskParms.memory]);
            if( transferTarget )
                if( creep.pos.isNearTo(transferTarget))
                    result = creep.transfer(transferTarget);
                else
                    result = ERR_NOT_IN_RANGE;
            else
                result = ERR_NOT_FOUND;
        }
        return result;
    }

}

var creepRole = {

    getJob: function(role) {
        let job = false;

        switch(role) {
            case "harvester":
            case "transport":
                job = "stateEmptyStore";
                break;
            case "builder":
                job = "stateBuild";
                break;
            case "repairer":
                job = "stateRepair";
                break;
            case "upgrader":
                job = "stateUpgrade";
                break;
            default:
                break;
        }

        return job;
    },

    event: function(creep,state,result) {

        switch(state) {
            case "stateHarvest":
                this.stateHarvestEvent(creep,result);
                break;
            default:
                break;
        }
    },

    stateHarvestEvent: function(creep,result) {
        switch(creep.memory.role) {
            case "harvester":
                switch(result) {
                    case OK:
                        if(!creep.memory.baseRange) {
                            creep.memory.baseRange = roleHarvester.getBaseRange(creep);
                            creep.memory.transportCoverage = roleHarvester.getTransportCoverage(creep);
                        }
                        break;
                    default:
                        break;
                }
                break;
            default:
                break;
        }
    },

    /**
     * Finds a target to supply or dropoff Resources at by creep roles
     * @param {Creep} creep 
     */
    findLogisticsTarget: function(creep) {

        let validTargetTypes = []; // Structure | Creep
        let validTargetKeys = []; // Structure -> structureType | Creep -> memory.role[keys]
        let validTargetValues = []; // structureType -> STRUCTURE_EXTENSION | memory.role[key] -> transport
        let logisticsTarget = false;

        switch(creep.memory.role) {
            case "harvester":
                if(!creep.memory.link && Memory.rooms[creep.room.name].links && Memory.rooms[creep.room.name].links.length > 2) {
                    this.assignLink(creep);
                    if(creep.memory.link) {
                        logisticsTarget = Game.getObjectById(creep.memory.link);
                        roleHarvester.clearLinkedTransports(creep);
                        creep.memory.transportCoverage = -1; //-1 is handled as a flag not to process transport validation and re-setup transportData
                        break; //breaks switch
                    }
                }

                //couldn't assign link with early switch break, so check if we have active transports assigned to us
                let servicingTransports = _.filter( Game.creeps, (c) => {
                    return (c.memory.role == "transport" && c.memory.target == creep.id)
                });

                // u.debug(servicingTransports,`servicingtransports found`);

                if( servicingTransports.length > 0 ) {
                    for( let t in servicingTransports ) {
                        // u.debug(creep.pos.isNearTo(servicingTransports[t]),`servicingtransports creep.pos.isNearTo(servicingTransports[t])`);
                        if( creep.pos.isNearTo(servicingTransports[t]) ) {
                            logisticsTarget = servicingTransports[t];
                            // u.debug(logisticsTarget,`servicingtransports logisticsTarget`);
                        }
                    }

                    // u.debug(logisticsTarget,`servicingtransports post for`);

                    //if we didn' thave one next to us, we'll use ourselves as a logistics target which will be used to signal for dropping resources
                    if( !logisticsTarget ) {
                        // u.debug(logisticsTarget,`servicingtransports self set`);
                        logisticsTarget = creep;
                    }
                    
                    break; //breaks switch
                }

                // if( transports && transports.length > 0 ) {
                //     for(var i=0;i<transports.length;i++) {
                //         if(creep.pos.isNearTo(transports[i])) {
                //             result = transports[i].withdraw(creep,RESOURCE_ENERGY);
                //             if(result == OK) {
                //                 let source = Game.getObjectById(creep.memory.source);
                //                 result = creep.harvest(source);
                //                 if(result == OK) {
                //                     return;
                //                 }
                //             }
                //         }
                //     }
                //     creep.drop(RESOURCE_ENERGY);
                //     return;
                // }


                //couldn't assign link or just drop for transports, do following
                let targets = creep.room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (structure.structureType == STRUCTURE_EXTENSION ||
                            structure.structureType == STRUCTURE_SPAWN ) &&
                            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                    }
                });
                if( targets.length > 0 ) {
                    logisticsTarget = targets[0];
                    creep.memory.dropoffTarget = logisticsTarget.id;
                    break;
                }
                break;
            case "transport":
                //TODO
                break;
            default:
                break;
        }

        // u.debug(logisticsTarget,`servicingtransports end function return`);

        return logisticsTarget;
    },

    /**
     * Generic find function e.g Harvesters can't always see remote Sources so resolve check room remoteSource list
     * @param {Creep} creep 
     * @param {Collection} taskParms 
     * @returns 
     */
    resolveTravelTarget: function(creep,taskParms) {
        //initialize
        let destPos = false;
        let taskParmKeys = Object.keys(taskParms);

        //execute
        if( _.includes(taskParmKeys, "memory") ) {
            switch( taskParms.memory ) {
                case "source":
                default:
                    destPos = roleHarvester.checkRemoteResource(creep.memory[taskParms.memory]);
                    break;
            }
        }

        return destPos;
    },

    /**
     * Retrieves dropOff target for creep - Different roles have different ways of storing dropOffTargets
     * @param {Creep} creep 
     * @returns 
     */
    resolveLogisticsTarget: function(creep) {
        //initialize
        let resolveList = [];
        resolveList.push(["supplyTarget","dropoffTarget"]);
        if( creep.memory.role == "harvester" )
            resolveList.push(["link"]);

        //validate
        let validTargets =  _.filter( resolveList, function(memoryLocation) {
            let t = Game.getObjectById(creep.memory[memoryLocation]);
            if( !t ) delete creep.memory[memoryLocation];
            return t;
        });

        //execute
        if( validTargets.length > 0 )
            return validTargets[0];
        else
            return false;
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

}

var roleHarvester = {

    run: function(creep) {
        creepStateMachine.run(creep);
        creepStateMachine.stateSave();
    },

    checkRemoteResource: function(objectId) {
        let roomPos = false;
        //determine if remote mining and is blind
        for( let r in Memory.rooms ) {
            _.forEach( Memory.rooms[r].remoteSources, (remoteSource) => {
                if(remoteSource.id == objectId) {
                    roomPos = new RoomPosition(remoteSource.x,remoteSource.y,remoteSource.room);
                    return false; //breaks the foreach
                }
            });
            if(roomPos)
                break; //breaks the for
        }
        return roomPos;
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
            //this works fine so commenting out the log spam - it just moves to remote room for now, TODO should change to x y json asap
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

    clearLinkedTransports(creep) {
        _.forEach(creep.memory.transportList, (transportData) => {
            let transport = Game.getObjectById(transportData.id);
            delete transport.memory.target;
        });
        delete creep.memory.transportList;
    }/*,
    
    taskEmptyStore: function(creep,taskParms) {

        //TODO must handle this in statemachine as its expensive every tick - also check initializer check for transport presence in home room
        //check if we have transports before dropping on floor at source
        let transports = _.filter( Game.creeps, (c) => {
            return c.memory.role == "transport"
        });


        if( transports && transports.length > 0 ) {
            for(var i=0;i<transports.length;i++) {
                if(creep.pos.isNearTo(transports[i])) {
                    result = transports[i].withdraw(creep,RESOURCE_ENERGY);
                    if(result == OK) {
                        let source = Game.getObjectById(creep.memory.source);
                        result = creep.harvest(source);
                        if(result == OK) {
                            return;
                        }
                    }
                }
            }
            creep.drop(RESOURCE_ENERGY);
            return;
        }
            
        
    }
*/
    // gotoTempTarget: function(creep) {
    //     var result = creep.transfer(Game.getObjectById(creep.memory.tempTarget), RESOURCE_ENERGY); //overridden by drop but compensating with transports for now.
            
    //     if(result == ERR_NOT_IN_RANGE) {
    //         creep.travelTo(Game.getObjectById(creep.memory.tempTarget), {visualizePathStyle: {stroke: '#ffffff'}});
    //     }
    //     else if( result == OK ) {
    //         delete creep.memory.tempTarget;
    //     }
    // },
};

module.exports = roleHarvester;
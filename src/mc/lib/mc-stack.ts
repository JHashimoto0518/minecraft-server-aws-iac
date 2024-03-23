import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class McStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // vpc
    const vpc = new ec2.Vpc(this, 'McVpc', {
      vpcName: 'mc-vpc',
      ipAddresses: ec2.IpAddresses.cidr('172.16.0.0/16'),
      natGateways: 0,
      maxAzs: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC
        },
      ],
      // remove all rules from default security group
      // See: https://docs.aws.amazon.com/config/latest/developerguide/vpc-default-security-group-closed.html
      restrictDefaultSecurityGroup: true
    });

    //
    // security group
    //
    const mcEc2Sg = new ec2.SecurityGroup(this, 'McEc2Sg', {
      vpc,
      allowAllOutbound: true,
      description: 'for a minecraft server'
    });
    mcEc2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'allow ssh from anywhere');
    // See: https://ip-ranges.amazonaws.com/ip-ranges.json
    mcEc2Sg.addIngressRule(ec2.Peer.ipv4('3.112.23.0/29'), ec2.Port.allTraffic(), 'allow ec2 instance connect from ap-northeast-1 ip range');
    mcEc2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(25565), 'allow minecraft connection from anywhere');

    //
    // Minecraft server
    //
    const mcEc2 = new ec2.Instance(this, 'McEc2', {
      instanceName: 'mc-ec2',
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpc,
      vpcSubnets: vpc.selectSubnets({
        subnetType: ec2.SubnetType.PUBLIC,
      }),
      associatePublicIpAddress: true,
      securityGroup: mcEc2Sg,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(8, {
            encrypted: true
          }),
        },
      ],
      propagateTagsToVolumeOnCreation: true,
    })

    // output public ip
    new CfnOutput(this, 'McServerPublicIp', {
      value: mcEc2.instancePublicIp,
    });
  }
}
